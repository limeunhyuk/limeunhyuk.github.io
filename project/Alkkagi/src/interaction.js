/**
 * @file interaction.js
 * @description
 * - 마우스 입력을 받아 바둑돌을 선택, 드래그, 조준하고 발사하는 핵심 상호작용 로직 담당
 * - Raycaster를 이용해 3D 공간의 클릭 위치를 추적하고, 시각적 조준선(궤적선) 및 선택 링을 렌더링
 * - 스킬 사용 시(스킬 매니저 위임)의 특수 마우스 조작도 여기서 감지하여 연결
 */

import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { scene, physicsWorld } from './engine.js';
import { getCamera } from './cameraManager.js';
import { state } from './state.js';
import { objects } from './stone.js';
import { updateStatusUI, resetSkillUI, toggleGameUI, updateSkillAvailabilityUI } from './ui.js';
import { skillManager } from './SkillManager.js';

// ── 핵심 상호작용 도구 ──
/** @type {THREE.Raycaster} raycaster - 2D 마우스 좌표를 3D 광선으로 변환해 오브젝트 충돌을 검사 */
export const raycaster = new THREE.Raycaster();
/** @type {THREE.Vector2} mouse - 정규화된 마우스 좌표 (-1 ~ 1) */
export const mouse = new THREE.Vector2();
/** @type {THREE.Plane} plane - 돌이 이동하는 y=0 평면 (드래그 교차점 계산용) */
export const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ── 시각적 가이드 객체 ──
/** @type {THREE.Line} dragLine - 마우스 드래그 방향과 반대로 늘어나는 당김선 */
export let dragLine;
/** @type {THREE.Line} trajectoryLine - 돌이 날아갈 예상 궤적을 보여주는 점선 */
export let trajectoryLine;
/** @type {THREE.Mesh} selectionRing - 현재 선택된 돌 아래에 표시되는 원형 테두리 */
export let selectionRing;
/** @type {THREE.SpotLight} hoverSpotLight - 마우스 오버 시 돌을 밝혀주는 스포트라이트 */
export let hoverSpotLight;

/**
 * @function initInteraction
 * @description
 * - 마우스(포인터) 이벤트 리스너(Down, Move, Up)를 브라우저 창에 등록
 * - 조준선(실선, 점선), 선택 링, 호버링 스포트라이트의 메쉬/광원을 생성하고 씬에 추가(비활성화 상태로 둠)
 */
export function initInteraction() {
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 선택 링 (발사할 돌 표시)
    const ringGeo = new THREE.RingGeometry(0.5, 0.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
    selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.visible = false;
    scene.add(selectionRing);

    // 당김선 (고무줄처럼 늘어나는 실선)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    dragLine = new THREE.Line(lineGeo, lineMat);
    dragLine.visible = false;
    scene.add(dragLine);

    // 궤적선 (발사 방향을 보여주는 점선)
    const trajGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const trajMat = new THREE.LineDashedMaterial({ color: 0xffaa00, linewidth: 2, scale: 1, dashSize: 0.3, gapSize: 0.3 });
    trajectoryLine = new THREE.Line(trajGeo, trajMat);
    trajectoryLine.visible = false;
    scene.add(trajectoryLine);

    // 마우스 호버 스포트라이트
    hoverSpotLight = new THREE.SpotLight(0xffffff, 25);
    hoverSpotLight.angle = Math.PI / 8;
    hoverSpotLight.penumbra = 0.8;
    hoverSpotLight.decay = 2;
    hoverSpotLight.distance = 10;
    hoverSpotLight.castShadow = true;
    hoverSpotLight.shadow.bias = -0.0001;
    hoverSpotLight.visible = false;
    scene.add(hoverSpotLight);
    scene.add(hoverSpotLight.target);
}

/**
 * @function onPointerDown
 * @description
 * - 마우스 좌클릭 시 Raycaster를 발사하여 대상 돌을 선택
 * - 스킬 매니저에게 먼저 클릭 이벤트를 넘겨(특수 스킬 조작인지 확인) 가로채지 않았다면 일반 조준 시작
 * @param {PointerEvent} e 
 */
function onPointerDown(e) {
    if (state.gameState !== "AIMING") return;
    if (e.button !== 0) return; // 좌클릭(0)일 때만 진행
    
    // 마우스 좌표를 WebGL NDC(-1 ~ 1) 좌표로 변환
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, getCamera());
    const intersects = raycaster.intersectObjects(objects.filter(o => o.active).map(o => o.mesh));
    
    const pointerPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, pointerPos);
    
    // 1. 최우선적으로 스킬 매니저에 이벤트 위임 (예: 벽 설치 스킬 클릭 등)
    if (skillManager.handlePointerDown(intersects, pointerPos)) return;
    
    // 이전 버전 하위 호환 위임 (텔레포트 스킬 등)
    if (skillManager.handleInteraction(intersects, pointerPos, selectionRing)) return;

    // 2. 일반 바둑돌 클릭 처리
    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const clickedStone = objects.find(o => o.mesh === hitMesh);
        
        // 현재 턴의 플레이어 돌만 조작 가능
        if (clickedStone.color !== state.currentTurn) return;

        state.draggedStone = clickedStone;
        
        // 선택 링을 돌 위치로 이동 후 표시
        selectionRing.position.set(state.draggedStone.mesh.position.x, 0.05, state.draggedStone.mesh.position.z);
        selectionRing.visible = true;
        dragLine.visible = false;
        trajectoryLine.visible = false;
    }
}

/**
 * @function onPointerMove
 * @description
 * - 마우스 이동 시 호버 이펙트(스포트라이트) 렌더링
 * - 돌을 드래그 중인 경우 당기는 힘(Power)과 방향을 계산하여 조준선(실선 및 점선 궤적) 업데이트
 * - 점선 궤적은 물리 엔진의 RayCast를 쏴서 다른 돌에 맞기 전까지의 길이만 그림
 * @param {PointerEvent} e 
 */
function onPointerMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, getCamera());
    const intersects = raycaster.intersectObjects(objects.filter(o => o.active).map(o => o.mesh));
    
    // 1. 호버 이펙트 처리 (아무 돌도 드래그하지 않고 조준 상태일 때)
    if (state.gameState === "AIMING" && !state.draggedStone) {
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const hoveredStone = objects.find(o => o.mesh === hitMesh);
            if (hoveredStone && hoveredStone.color === state.currentTurn) {
                hoverSpotLight.position.set(hitMesh.position.x, 3, hitMesh.position.z);
                hoverSpotLight.target.position.copy(hitMesh.position);
                hoverSpotLight.visible = true;
                
                // 흑돌은 붉은색, 백돌은 녹색 톤으로 스포트라이트 색상 설정
                hoverSpotLight.color.setHex(state.currentTurn === 'black' ? 0xffaaaa : 0xaaffaa);
            } else {
                hoverSpotLight.visible = false;
            }
        } else {
            hoverSpotLight.visible = false;
        }
    } else {
        hoverSpotLight.visible = false;
    }

    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    // 2. 스킬 위임 (마우스 따라다니는 스킬 이펙트 등)
    if (skillManager.handlePointerMove(intersects, intersectPoint)) return;

    if (!state.draggedStone || state.gameState !== "AIMING") return;
    
    // 텔레포트 스킬 중에는 드래그 조준선 비활성화
    if (state.currentSkill === "TELEPORT") return;
    
    // 3. 드래그 계산 (마우스를 당긴 반대 방향으로 벡터 생성)
    const startVec = new THREE.Vector3(state.draggedStone.mesh.position.x, 0.2, state.draggedStone.mesh.position.z);
    const dragVec = new THREE.Vector3().subVectors(startVec, intersectPoint);
    
    // 최대 드래그 길이 제한 (너무 세게 날아가는 것 방지)
    const maxDrag = 3.5;
    if (dragVec.length() > maxDrag) dragVec.setLength(maxDrag);
    
    const powerMultiplier = 1.0;
    const power = dragVec.length() * powerMultiplier;
    
    // 실선(당김선) 업데이트
    const lineEnd = startVec.clone().sub(dragVec);
    dragLine.geometry.setFromPoints([startVec, lineEnd]);
    dragLine.visible = true;
    
    // 4. 점선(예상 궤적) 업데이트 (물리적 Raycast 적용)
    if (dragVec.length() > 0.1) {
        const dir = dragVec.clone().normalize();
        
        // 돌 중심에서 약간 떨어진 곳부터 쏴서 자기 자신을 맞히는 것 방지 (0.45)
        const rayStart = new THREE.Vector3(startVec.x + dir.x * 0.45, 0.125, startVec.z + dir.z * 0.45);
        const ray = new RAPIER.Ray(
            { x: rayStart.x, y: rayStart.y, z: rayStart.z }, 
            { x: dir.x, y: 0, z: dir.z }
        );
        const hit = physicsWorld.castRay(ray, 20.0, true);
        
        // 다른 돌이나 벽에 맞았다면 그 거리까지만 점선을 그림
        const distance = hit ? hit.timeOfImpact + 0.45 : 20.0;
        const endVec = startVec.clone().add(dir.multiplyScalar(distance));
        endVec.y = 0.2;

        // 당기는 힘에 비례해 점선의 간격(Dash) 조절
        const dashFactor = Math.max(0.2, Math.min(1.0, power * 0.05));
        trajectoryLine.material.dashSize = dashFactor;
        trajectoryLine.material.gapSize = dashFactor;
        
        trajectoryLine.geometry.dispose(); 
        trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
        trajectoryLine.computeLineDistances();
        trajectoryLine.visible = true;
    } else {
        trajectoryLine.visible = false;
    }
}

/**
 * @function onPointerUp
 * @description
 * - 마우스를 놓았을 때 드래그 길이를 기반으로 힘을 물리 엔진 바디(RigidBody)에 적용하여 발사(Impulse)
 * - 발사 후 게임 상태를 MOVING으로 바꾸고, 스킬 소모 처리 및 턴 넘김 수행
 * @param {PointerEvent} e 
 */
function onPointerUp(e) {
    if (!state.draggedStone || state.gameState !== "AIMING" || state.currentSkill === "TELEPORT") return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, getCamera());
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    const startVec = new THREE.Vector3(state.draggedStone.mesh.position.x, 0, state.draggedStone.mesh.position.z);
    const dragVec = new THREE.Vector3().subVectors(startVec, intersectPoint);
    
    const maxDrag = 3.5;
    if (dragVec.length() > maxDrag) dragVec.setLength(maxDrag);

    const powerMultiplier = 1.0; 
    const power = dragVec.length() * powerMultiplier;
    
    // 아주 조금 당긴 것은 취소로 간주
    if (power > 0.5) {
        state.projectileSkill = state.currentSkill;

        // 발사 시점 기준(턴 전환 전)으로 스킬 소모 기록
        skillManager.markSkillUsed(state.currentTurn, state.currentSkill);

        // 물리 엔진 객체에 순간적인 충격량(Impulse) 적용
        dragVec.normalize().multiplyScalar(power);
        state.draggedStone.body.applyImpulse({ x: dragVec.x, y: 0, z: dragVec.z }, true);

        // 턴 시작 설정 (이동 상태로 진입)
        state.gameState = "MOVING";
        state.firstCollisionOccurred = false;
        state.currentSlowMoFactor = 1.0;

        // 턴 전환 (발사와 동시에 턴 넘어감)
        state.currentTurn = state.currentTurn === 'black' ? 'white' : 'black';
        updateStatusUI();
        
        toggleGameUI(false);
        state.teleportSelectedStone = null;
        resetSkillUI();
        updateSkillAvailabilityUI();
    }
    
    // 조준선 숨김 및 드래그 변수 초기화
    selectionRing.visible = false;
    dragLine.visible = false;
    trajectoryLine.visible = false;
    state.draggedStone = null;
}
