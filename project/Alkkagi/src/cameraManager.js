/**
 * @file cameraManager.js
 * @description
 * - 게임 내 모든 카메라 시점 이동, 회전, 줌 기능을 총괄
 * - 상태에 따라 여러 가지 카메라 모드(기본, 추적, 자유시점, 스킬 연출)를 전환
 * - 키보드 입력을 받아 카메라의 구면 좌표계(Spherical) 위치를 부드럽게 보간(Lerp)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setBrightness } from './engine.js';
import { setWeather } from './weather.js';

// ── 내부 상태 변수 ──
/** @type {THREE.PerspectiveCamera|null} camera - 메인 카메라 인스턴스 */
let camera = null;
/** @type {string} currentMode - 현재 활성화된 카메라 제어 모드 (DEFAULT, FOLLOW 등) */
let currentMode = 'DEFAULT';
/** @type {OrbitControls|null} orbitControls - 마우스 조작을 위한 Three.js 내장 컨트롤러 (ORBITCONTROL 모드용) */
let orbitControls = null;
/** @type {Function|null} customUpdater - 스킬 연출 등 사용자 정의 카메라 이동 콜백 */
let customUpdater = null;

// 카메라 보간(Lerp)을 위한 현재값과 목표값 벡터
let currentCamPos = new THREE.Vector3(0, 40, 0);
let targetCamPos = new THREE.Vector3(0, 40, 0);
let currentCamLook = new THREE.Vector3(0, 0, 0);
let targetCamLook = new THREE.Vector3(0, 0, 0);

// DEFAULT 모드용 키보드 입력 상태 관리 객체
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// 구면 좌표계(Spherical) 변수 (DEFAULT 모드의 회전 및 줌 관리)
let camTarget = new THREE.Vector3(0, 0, 0); // 카메라가 바라보는 중심축
let camTheta = 0; // 수평 회전 각도
let camPhi = 0.245; // 수직 회전 각도 (0은 정수리 위, 커질수록 옆에서 봄)
let defatultCamRadius = 32.0; // 기본 카메라 거리
let camRadius = defatultCamRadius; // 현재 카메라 거리 (확대/축소)

// ── 외부 공개 API ──

/** 카메라 구동 모드 상수 열거형 */
export const CAMERA_MODES = {
    DEFAULT: 'DEFAULT', // 키보드로 조작하는 기본 조준 탑뷰 시점
    FOLLOW: 'FOLLOW',   // 돌이 이동할 때 부드럽게 추적하는 액션 시점
    ORBITCONTROL: 'ORBITCONTROL', // 마우스 우클릭으로 자유롭게 둘러보는 모드
    SKILL: 'SKILL'  // 특정 스킬 발동 시 적용되는 커스텀 연출 시점
};

/**
 * @function getCamera
 * @returns {THREE.PerspectiveCamera} 현재 메인 카메라 객체 반환
 */
export function getCamera() {
    return camera;
}

/**
 * @function initCameraManager
 * @description
 * - 씬에 PerspectiveCamera 추가 및 초기 해상도 비율 설정
 * - OrbitControls 인스턴스 생성 및 키보드/마우스 이벤트 리스너 등록
 * - 카메라 단축키(초기화, 밝기, 날씨 조절 등) 처리
 * @param {THREE.Scene} scene - 카메라를 추가할 씬
 * @param {HTMLElement} domElement - 이벤트 리스너를 붙일 캔버스
 */
export function initCameraManager(scene, domElement) {
    if (!camera) {
        camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 40, 0);
        camera.lookAt(0, 0, 0);
    }
    
    scene.add(camera);

    orbitControls = new OrbitControls(camera, domElement);
    orbitControls.enableDamping = true;
    orbitControls.enabled = false;
    
    // 우클릭으로 회전하도록 마우스 버튼 매핑 변경
    orbitControls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    };
    
    currentCamPos.copy(camera.position);
    targetCamPos.copy(camera.position);
    currentCamLook.set(0, 0, 0);
    targetCamLook.set(0, 0, 0);

    // 창 크기 변경 시 카메라 비율 동기화
    window.addEventListener('resize', () => {
        if (camera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
    });

    window.addEventListener('keydown', (e) => {
        const key = e.key;
        // 카메라 시점 초기화 단축키
        if (key === 'r' || key === 'R') {
            camTarget.set(0, 0, 0);
            camTheta = 0;
            camPhi = 0.245;
            camRadius = 32.0;
        }
        // 화면 밝기 조절 단축키 (1~5)
        if (key >= '1' && key <= '5') {
            setBrightness(parseInt(key));
        }
        // 날씨 제어 단축키 (6~0)
        if (['6','7','8','9','0'].includes(key)) {
            setWeather(key);
        }
        
        // 이동 및 회전 조작 키
        if (key === 'w' || key === 'W') keys.w = true;
        if (key === 's' || key === 'S') keys.s = true;
        if (key === 'a' || key === 'A') keys.a = true;
        if (key === 'd' || key === 'D') keys.d = true;
        if (key === 'q' || key === 'Q') keys.q = true;
        if (key === 'e' || key === 'E') keys.e = true;
        if (key === 'ArrowUp') keys.ArrowUp = true;
        if (key === 'ArrowDown') keys.ArrowDown = true;
        if (key === 'ArrowLeft') keys.ArrowLeft = true;
        if (key === 'ArrowRight') keys.ArrowRight = true;
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key;
        if (key === 'w' || key === 'W') keys.w = false;
        if (key === 's' || key === 'S') keys.s = false;
        if (key === 'a' || key === 'A') keys.a = false;
        if (key === 'd' || key === 'D') keys.d = false;
        if (key === 'q' || key === 'Q') keys.q = false;
        if (key === 'e' || key === 'E') keys.e = false;
        if (key === 'ArrowUp') keys.ArrowUp = false;
        if (key === 'ArrowDown') keys.ArrowDown = false;
        if (key === 'ArrowLeft') keys.ArrowLeft = false;
        if (key === 'ArrowRight') keys.ArrowRight = false;
    });

    setCameraMode(CAMERA_MODES.DEFAULT);
}

/**
 * @function setCameraMode
 * @description
 * - 활성화할 카메라 모드를 변경하고 필요한 컨트롤러(Orbit 등)를 온/오프
 * @param {string} mode - 변경할 모드 이름 (CAMERA_MODES 참조)
 * @param {Function} [updater=null] - SKILL 모드 시 주입할 커스텀 콜백
 */
export function setCameraMode(mode, updater = null) {
    currentMode = mode;
    customUpdater = updater;
    if (orbitControls) {
        orbitControls.enabled = (mode === CAMERA_MODES.ORBITCONTROL);
    }
}

/**
 * @function setCameraTarget
 * @description
 * - FOLLOW 모드 등에서 보간하며 따라갈 최종 목표 위치(target)를 지정
 * @param {THREE.Vector3} position - 목표 카메라 위치
 * @param {THREE.Vector3} lookAt - 목표 카메라 시선(바라보는 곳)
 */
export function setCameraTarget(position, lookAt) {
    if (position) targetCamPos.copy(position);
    if (lookAt) targetCamLook.copy(lookAt);
}

/**
 * @function snapCameraTo
 * @description
 * - 카메라의 위치와 시선을 보간 없이 즉시(순간이동) 해당 위치로 고정
 * @param {THREE.Vector3} position - 즉시 이동할 위치
 * @param {THREE.Vector3} lookAt - 즉시 바라볼 시선
 */
export function snapCameraTo(position, lookAt) {
    if (position) {
        camera.position.copy(position);
        currentCamPos.copy(position);
        targetCamPos.copy(position);
    }
    if (lookAt) {
        camera.lookAt(lookAt);
        currentCamLook.copy(lookAt);
        targetCamLook.copy(lookAt);
    }
}

/**
 * @function updateActionCamera
 * @description
 * - 돌이 움직이는 도중(MOVING 상태)에 가장 격렬하게 움직이는 두 돌(Pair)을 찾아 카메라가 자동으로 추적하도록 설정
 * - 두 돌의 거리가 가까워지고 속도가 빠를수록 슬로우 모션(Slow-mo) 팩터를 낮춰 극적인 연출을 생성
 * @param {Array} objects - 물리 객체 배열
 * @param {Array|null} currentLockedPair - 현재 추적 중인 돌의 쌍
 * @param {boolean} firstCollisionOccurred - 이미 충돌 이벤트가 한 번 처리되었는지 여부
 * @returns {Object} { targetSlowMo (적용할 슬로우모션 수치), newLockedPair (새로 찾은 추적 대상 쌍) }
 */
export function updateActionCamera(objects, currentLockedPair, firstCollisionOccurred) {
    let targetSlowMo = 1.0;
    let newLockedPair = currentLockedPair;
    
    // 기본적으로 FOLLOW 모드 유지
    setCameraMode(CAMERA_MODES.FOLLOW);
    setCameraTarget(new THREE.Vector3(0, 40, 0), new THREE.Vector3(0, 0, 0));

    // 첫 충돌 이전까지만 액션 카메라 추적 적용 (충돌 후에는 일반 시점으로 돌아옴)
    if (!firstCollisionOccurred) {
        let minDistanceSq = 9999;
        let closestPair = null;

        // 1. 기존 추적 타겟(Locked Pair)이 여전히 유효한지 검사
        if (newLockedPair && newLockedPair[0].active && newLockedPair[1].active) {
            const v1 = newLockedPair[0].body.linvel();
            const v2 = newLockedPair[1].body.linvel();
            const isMoving = (v1.x*v1.x + v1.z*v1.z > 0.5) || (v2.x*v2.x + v2.z*v2.z > 0.5);
            const distSq = newLockedPair[0].mesh.position.distanceToSquared(newLockedPair[1].mesh.position);
            // 일정 속도 이상이고 거리가 너무 멀어지지 않았다면 타겟 유지
            if (isMoving && distSq < 25.0) {
                minDistanceSq = distSq;
                closestPair = newLockedPair;
            } else {
                newLockedPair = null;
            }
        }

        // 2. 타겟을 잃었다면 모든 돌을 순회하여 가장 충돌 위험이 높은(가까운) 두 돌을 새로 탐색
        if (!newLockedPair) {
            for (let i = 0; i < objects.length; i++) {
                if (!objects[i].active) continue;
                const v1 = objects[i].body.linvel();
                const isMoving1 = (v1.x * v1.x + v1.z * v1.z) > 1.0;
                for (let j = i + 1; j < objects.length; j++) {
                    if (!objects[j].active) continue;
                    const v2 = objects[j].body.linvel();
                    const isMoving2 = (v2.x * v2.x + v2.z * v2.z) > 1.0;
                    
                    // 두 돌 중 하나라도 빠르게 움직이고 있어야 함
                    if (!isMoving1 && !isMoving2) continue;
                    const distSq = objects[i].mesh.position.distanceToSquared(objects[j].mesh.position);
                    if (distSq < minDistanceSq) {
                        minDistanceSq = distSq;
                        closestPair = [objects[i], objects[j]];
                    }
                }
            }
            if (minDistanceSq < 16.0 && closestPair) newLockedPair = closestPair;
        }

        // 3. 록온(Lock-on)된 돌이 있다면 거리와 상대 속도를 기반으로 슬로우 모션 및 줌인 계산
        if (minDistanceSq < 16.0 && closestPair) {
            const dist = Math.sqrt(minDistanceSq);
            const v1 = closestPair[0].body.linvel();
            const v2 = closestPair[1].body.linvel();
            const relativeVel = new THREE.Vector3(v1.x - v2.x, 0, v1.z - v2.z).length();
            
            // 물리적인 접근 시간을 계산하여 얼마나 늦춰야 할지(슬로우 모션) 산출
            const originalTime = (dist - 0.8) / Math.max(0.1, relativeVel);
            const desiredTime = 1.2; 
            let optimalSlowMo = Math.max(0.05, Math.min(1.0, originalTime / desiredTime));
            let distFactor = Math.max(0.0, Math.min(1.0, (dist - 0.8) / (4.0 - 0.8)));

            targetSlowMo = optimalSlowMo + (1.0 - optimalSlowMo) * distFactor;
            
            // 두 돌의 중간 지점을 계산하고 카메라를 그 방향으로 당김
            const midPoint = new THREE.Vector3().addVectors(closestPair[0].mesh.position, closestPair[1].mesh.position).multiplyScalar(0.5);
            
            const finalCamPos = new THREE.Vector3(midPoint.x * 0.3, 22, midPoint.z * 0.3 + 15);
            const startCamPos = new THREE.Vector3(0, 40, 0);
            const lerpedCamPos = new THREE.Vector3().lerpVectors(finalCamPos, startCamPos, Math.pow(distFactor, 1.2));
            
            setCameraTarget(lerpedCamPos, midPoint);
        } else {
            newLockedPair = null;
        }
    }
    
    return { targetSlowMo, newLockedPair };
}

/**
 * @function updateCamera
 * @description
 * - 메인 게임 루프(animate)에서 매 프레임 호출되어 실제 카메라 객체를 이동시킴
 * - 모드에 따라 키보드 입력을 처리(DEFAULT)하거나 목표를 부드럽게 따라감(FOLLOW)
 * @param {number} deltaTime - 프레임 간 델타 타임
 */
export function updateCamera(deltaTime) {
    switch (currentMode) {
        case CAMERA_MODES.DEFAULT:
            const dt = Math.max(0.001, deltaTime);
            const rotSpeed = 1.0 * dt; 
            const moveSpeed = 15.0 * dt; 
            const zoomSpeed = 20.0 * dt;

            // 키보드 입력을 받아 구면 좌표계 각도 조정 (회전)
            if (keys.w) camPhi -= rotSpeed;
            if (keys.s) camPhi += rotSpeed;
            if (keys.a) camTheta -= rotSpeed;
            if (keys.d) camTheta += rotSpeed;
            
            // 확대 및 축소
            if (keys.q) camRadius -= zoomSpeed;
            if (keys.e) camRadius += zoomSpeed;
            camRadius = Math.max(10.0, Math.min(58.0, camRadius));

            // 카메라가 바닥 아래로 파고들지 않도록 수직 각도(Phi) 제한
            const MAX_PHI = (80 * Math.PI) / 180;
            camPhi = Math.max(0.1, Math.min(MAX_PHI, camPhi));

            // 카메라가 현재 바라보고 있는 수평 방향(Forward, Right)을 계산
            const forward = new THREE.Vector3(-Math.sin(camTheta), 0, -Math.cos(camTheta));
            const right = new THREE.Vector3(-Math.cos(camTheta), 0, Math.sin(camTheta));

            // 방향키 입력 시 바라보는 기준 축 자체를 이동 (FPS 시점과 유사)
            if (keys.ArrowUp) camTarget.addScaledVector(forward, moveSpeed);
            if (keys.ArrowDown) camTarget.addScaledVector(forward, -moveSpeed);
            if (keys.ArrowLeft) camTarget.addScaledVector(right, moveSpeed); 
            if (keys.ArrowRight) camTarget.addScaledVector(right, -moveSpeed); 

            // 중심축 이동 한계선 설정 (바둑판을 너무 벗어나지 않게)
            camTarget.x = Math.max(-10, Math.min(10, camTarget.x));
            camTarget.z = Math.max(-10, Math.min(10, camTarget.z));

            // 구면 좌표계를 직교 좌표계(XYZ)로 변환
            targetCamPos.x = camTarget.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta);
            targetCamPos.y = camTarget.y + camRadius * Math.cos(camPhi);
            targetCamPos.z = camTarget.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta);
            targetCamLook.copy(camTarget);

            // 최종 보간 처리 후 적용
            currentCamPos.lerp(targetCamPos, 0.1);
            currentCamLook.lerp(targetCamLook, 0.1);
            
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
            break;

        case CAMERA_MODES.FOLLOW:
            // 액션 모드 등에서 지시한 목표값을 부드럽게 추적
            currentCamPos.lerp(targetCamPos, 0.005);
            currentCamLook.lerp(targetCamLook, 0.005);
            
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
            break;

        case CAMERA_MODES.ORBITCONTROL:
            // 마우스 자유 시점 조작 업데이트
            if (orbitControls) {
                orbitControls.update();
                currentCamPos.copy(camera.position);
                targetCamPos.copy(camera.position);
            }
            break;

        case CAMERA_MODES.SKILL:
            // 특정 스킬 고유의 연출 카메라 업데이트 (예: 리듬 미니게임용 카메라)
            if (customUpdater) {
                customUpdater(camera, deltaTime);
            }
            break;
    }
}
