import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==========================================
// 1. 모듈 내부 상태 (Private Variables)
// ==========================================

let camera = null;           // 메인 카메라 객체
let currentMode = 'DEFAULT';  // 현재 카메라 제어 모드
let orbitControls = null;     // OrbitControls 인스턴스
let customUpdater = null;     // SKILL 모드용 업데이트 콜백

let currentCamPos = new THREE.Vector3(0, 40, 0);   // 현재 위치 (보간용)
let targetCamPos = new THREE.Vector3(0, 40, 0);    // 목표 위치
let currentCamLook = new THREE.Vector3(0, 0, 0);   // 현재 시선 (보간용)
let targetCamLook = new THREE.Vector3(0, 0, 0);    // 목표 시선

// ==========================================
// 2. 외부 노출 상수 및 함수 (Exported API)
// ==========================================

export const CAMERA_MODES = {
    DEFAULT: 'DEFAULT',
    FOLLOW: 'FOLLOW',
    ORBITCONTROL: 'ORBITCONTROL',
    SKILL: 'SKILL'
};

/** 렌더링을 위해 카메라 객체를 반환합니다. */
export function getCamera() {
    return camera;
}

/** 카메라 및 컨트롤러 초기화 */
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
    
    // 우클릭으로 회전하도록 변경
    orbitControls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    };
    
    currentCamPos.copy(camera.position);
    targetCamPos.copy(camera.position);
    currentCamLook.set(0, 0, 0);
    targetCamLook.set(0, 0, 0);

    window.addEventListener('resize', () => {
        if (camera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
    });

    setCameraMode(CAMERA_MODES.DEFAULT);
}

/** 카메라 모드 변경 */
export function setCameraMode(mode, updater = null) {
    currentMode = mode;
    customUpdater = updater;
    if (orbitControls) {
        orbitControls.enabled = (mode === CAMERA_MODES.ORBITCONTROL);
    }
}

/** 목표 위치와 시선 설정 */
export function setCameraTarget(position, lookAt) {
    if (position) targetCamPos.copy(position);
    if (lookAt) targetCamLook.copy(lookAt);
}

/** 즉시 이동 */
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
 * 액션 카메라 업데이트 (돌 이동 중)
 * - 가장 가까운 두 돌을 찾아 카메라 목표를 설정하고 슬로우 모션 팩터를 반환합니다.
 * @param {Array} objects - 물리 객체 배열
 * @param {Array|null} currentLockedPair - 현재 추적 중인 돌 쌍
 * @param {boolean} firstCollisionOccurred - 첫 충돌 발생 여부
 * @returns {Object} { targetSlowMo, newLockedPair }
 */
export function updateActionCamera(objects, currentLockedPair, firstCollisionOccurred) {
    let targetSlowMo = 1.0;
    let newLockedPair = currentLockedPair;
    
    // 기본적으로 FOLLOW 모드 유지, 타겟 초기화
    setCameraMode(CAMERA_MODES.FOLLOW);
    setCameraTarget(new THREE.Vector3(0, 40, 0), new THREE.Vector3(0, 0, 0));

    if (!firstCollisionOccurred) {
        let minDistanceSq = 9999;
        let closestPair = null;

        // Lock-on logic
        if (newLockedPair && newLockedPair[0].active && newLockedPair[1].active) {
            const v1 = newLockedPair[0].body.linvel();
            const v2 = newLockedPair[1].body.linvel();
            const isMoving = (v1.x*v1.x + v1.z*v1.z > 0.5) || (v2.x*v2.x + v2.z*v2.z > 0.5);
            const distSq = newLockedPair[0].mesh.position.distanceToSquared(newLockedPair[1].mesh.position);
            if (isMoving && distSq < 25.0) {
                minDistanceSq = distSq;
                closestPair = newLockedPair;
            } else {
                newLockedPair = null;
            }
        }

        if (!newLockedPair) {
            for (let i = 0; i < objects.length; i++) {
                if (!objects[i].active) continue;
                const v1 = objects[i].body.linvel();
                const isMoving1 = (v1.x * v1.x + v1.z * v1.z) > 1.0;
                for (let j = i + 1; j < objects.length; j++) {
                    if (!objects[j].active) continue;
                    const v2 = objects[j].body.linvel();
                    const isMoving2 = (v2.x * v2.x + v2.z * v2.z) > 1.0;
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

        // Slow-mo and zoom logic
        if (minDistanceSq < 16.0 && closestPair) {
            const dist = Math.sqrt(minDistanceSq);
            const v1 = closestPair[0].body.linvel();
            const v2 = closestPair[1].body.linvel();
            const relativeVel = new THREE.Vector3(v1.x - v2.x, 0, v1.z - v2.z).length();
            
            const originalTime = (dist - 0.8) / Math.max(0.1, relativeVel);
            const desiredTime = 1.2; 
            let optimalSlowMo = Math.max(0.05, Math.min(1.0, originalTime / desiredTime));
            let distFactor = Math.max(0.0, Math.min(1.0, (dist - 0.8) / (4.0 - 0.8)));

            targetSlowMo = optimalSlowMo + (1.0 - optimalSlowMo) * distFactor;
            
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

/** 매 프레임 카메라 업데이트 */
export function updateCamera(deltaTime) {
    console.log(currentMode);
    switch (currentMode) {
        case CAMERA_MODES.DEFAULT:
            targetCamPos.set(0, 40, 10);
            targetCamLook.set(0, 0, 0);

            currentCamPos.lerp(targetCamPos, 0.1);
            currentCamLook.lerp(targetCamLook, 0.1);
            
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
            break;
        case CAMERA_MODES.FOLLOW:
            currentCamPos.lerp(targetCamPos, 0.005);
            currentCamLook.lerp(targetCamLook, 0.005);
            
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
            break;

        case CAMERA_MODES.ORBITCONTROL:
            if (orbitControls) {
                orbitControls.update();
                currentCamPos.copy(camera.position);
                targetCamPos.copy(camera.position);
            }
            break;

        case CAMERA_MODES.SKILL:
            if (customUpdater) {
                customUpdater(camera, deltaTime);
            }
            break;
    }
}
