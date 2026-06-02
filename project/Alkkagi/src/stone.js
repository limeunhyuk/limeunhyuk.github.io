/**
 * @file stone.js
 * @description
 * - 바둑돌(Stone) 메쉬 및 물리 객체(RigidBody)의 생성, 삭제, 상태 추적 담당
 * - 돌이 바둑판(보드) 밖으로 떨어졌는지 판별하고 게임 오버/낙사 이펙트를 처리
 */

import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { scene, physicsWorld } from './engine.js';
import { assets } from './assets.js';
import { state } from './state.js';
import { updateStatusUI } from './ui.js';
import { createFallEffect } from './skillsVFX.js';

/** 
 * @type {Array<Object>} objects
 * - 현재 게임에 존재하는 모든 활성/비활성 바둑돌 객체의 배열
 * - 구조: { mesh, body, type, color, active }
 */
export const objects = [];

/**
 * @function clearStones
 * @description
 * - 씬(Scene)과 물리 세계(World)에서 모든 바둑돌 객체를 완전히 제거
 * - 새 게임을 시작하거나 초기화할 때 호출됨
 */
export function clearStones() {
    objects.forEach(obj => {
        scene.remove(obj.mesh);
        physicsWorld.removeRigidBody(obj.body);
    });
    objects.length = 0;
}

/**
 * @function createStones
 * @description
 * - 흑돌과 백돌을 지정된 위치 또는 기본 대형에 맞게 생성 및 배치
 * - Three.js 메쉬와 Rapier 물리 바디, 충돌 콜라이더를 묶어 objects 배열에 등록
 * 
 * @param {number} bCount - 흑돌 수
 * @param {number} wCount - 백돌 수
 * @param {Array<{x:number,z:number}>|null} bPositions - 흑돌 커스텀 좌표 (없으면 기본 배치)
 * @param {Array<{x:number,z:number}>|null} wPositions - 백돌 커스텀 좌표 (없으면 기본 배치)
 */
export function createStones(bCount, wCount, bPositions = null, wPositions = null) {
    clearStones();

    // 전역 상태에 돌 개수 초기화
    state.totalBlack = bCount;
    state.totalWhite = wCount;
    state.currentBlack = bCount;
    state.currentWhite = wCount;

    const positions = [];

    // 포진 선택 정보가 전달된 경우 해당 좌표 사용
    if (bPositions && wPositions) {
        bPositions.forEach(p => positions.push({ x: p.x, z: p.z, color: 'black' }));
        wPositions.forEach(p => positions.push({ x: p.x, z: p.z, color: 'white' }));
    } else {
        // 커스텀 배치가 없을 경우 5xN 기본 사각형 배치 수행
        for (let i = 0; i < bCount; i++) {
            const row = Math.floor(i / 5), col = i % 5;
            positions.push({ x: -4 + col * 2.0 + (row % 2 ? 1.0 : 0.0), z: 6 - row, color: 'black' });
        }
        for (let i = 0; i < wCount; i++) {
            const row = Math.floor(i / 5), col = i % 5;
            positions.push({ x: -4 + col * 2.0 + (row % 2 ? 1.0 : 0.0), z: -6 + row, color: 'white' });
        }
    }

    const radius = 0.4;
    const height = 0.25;
    
    // 고급 물리 기반 렌더링(PBR) 재질 사용 (코팅된 바둑돌 느낌)
    const blackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.1, clearcoat: 0.5 });
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xeeeeee, roughness: 0.1, clearcoat: 0.5 });

    positions.forEach(pos => {
        let mesh;
        // 외부 에셋 모델이 로드되었으면 우선 사용, 없으면 Three.js 기본 구체(Sphere) 사용
        if (assets.models.stone) {
            mesh = assets.models.stone.clone();
            mesh.traverse((node) => {
                if (node.isMesh) {
                    node.material = pos.color === 'black' ? blackMat : whiteMat;
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
        } else {
            const stoneGeo = new THREE.SphereGeometry(radius, 32, 16);
            stoneGeo.scale(1, 0.5, 1); 
            mesh = new THREE.Mesh(stoneGeo, pos.color === 'black' ? blackMat : whiteMat);
        }

        mesh.position.set(pos.x, 0.125, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        // 물리 바디(RigidBody) 세팅: 위치 및 마찰(저항) 설정
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, 0.125, pos.z)
            .setLinearDamping(2.0)
            .setAngularDamping(2.0);
            
        const body = physicsWorld.createRigidBody(bodyDesc);
        
        // 충돌 그룹 설정 (방해 스킬 필터링에 사용)
        // 흑돌 = 그룹 1 (0x0001), 백돌 = 그룹 2 (0x0002)
        // 필터 0xFFFF → 모든 그룹(돌, 바닥, 벽)과 충돌 허용
        const stoneGroup = pos.color === 'black'
            ? (0x0001 << 16) | 0xFFFF
            : (0x0002 << 16) | 0xFFFF;

        // 콜라이더(Collider) 세팅: 형태, 탄성력, 마찰력, 질량
        const colliderDesc = RAPIER.ColliderDesc.cylinder(height/2, radius)
            .setRestitution(0.9)
            .setFriction(0.3)
            .setDensity(1.0)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
            .setCollisionGroups(stoneGroup);

        physicsWorld.createCollider(colliderDesc, body);

        objects.push({ mesh, body, type: 'stone', color: pos.color, active: true });
    });
}

/**
 * @function checkFallOffBoard
 * @description
 * - 프레임마다 호출되어 바둑판 영역(15x15)을 완전히 벗어난 돌을 감지
 * - 낙사한 돌은 비활성화하고 점수를 차감하며, 남은 개수에 따라 게임 오버 여부를 판별
 * @param {Function} onGameOver - 게임 오버 조건을 충족했을 때 호출할 콜백 함수
 */
export function checkFallOffBoard(onGameOver) {
    if (state.gameState === "MENU" || state.gameState === "GAMEOVER") return;

    objects.forEach(obj => {
        if (obj.active) {
            const pos = obj.body.translation();
            // 바둑판 경계선(7.5) 밖으로 시각적으로 떨어졌다고 판단되는 기준선(10.0) 검사
            const isOffHorizontally = Math.abs(pos.x) > 10.0 || Math.abs(pos.z) > 10.0;
            // 바닥 아래로 추락했는지 검사
            const isOffVertically = pos.y < -1.0;

            if (isOffHorizontally || isOffVertically) {
                // 바닥 밑에서 낙사 이펙트가 터져 가려지지 않도록 높이를 -0.4로 보정
                const effectY = Math.max(-0.4, pos.y);
                const fallPos = new THREE.Vector3(pos.x, effectY, pos.z);
                createFallEffect(fallPos);
                
                // 추락한 돌 비활성화 및 은닉
                obj.active = false;
                obj.mesh.visible = false;
                obj.body.setTranslation({ x: 0, y: -100, z: 0 }, true);
                
                // 점수(잔여 돌 개수) 업데이트
                if (obj.color === 'black') state.currentBlack--;
                if (obj.color === 'white') state.currentWhite--;
                
                updateStatusUI();
            }
        }
    });

    // 승패 판별 로직
    if (state.currentBlack === 0 && state.currentWhite > 0) {
        onGameOver("white");
    } else if (state.currentWhite === 0 && state.currentBlack > 0) {
        onGameOver("black");
    } else if (state.currentBlack === 0 && state.currentWhite === 0) {
        onGameOver("draw");
    }
}
