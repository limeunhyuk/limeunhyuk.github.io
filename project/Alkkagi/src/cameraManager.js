import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==========================================
// 1. 모듈 내부 상태 (Private Variables)
// ==========================================

/** @type {THREE.PerspectiveCamera} 메인 카메라 객체 (캡슐화됨) */
let camera = null;

/** @type {string} 현재 카메라의 제어 모드 (DEFAULT, FOLLOW, ORBITCONTROL, SKILL) */
let currentMode = 'DEFAULT';

/** @type {OrbitControls} 사용자 인터랙션을 위한 컨트롤러 */
let orbitControls = null;

/** @type {Function} SKILL 모드 시 실행될 커스텀 카메라 업데이트 함수 */
let customUpdater = null;

/** @type {THREE.Vector3} 카메라의 현재 위치 보간용 벡터 */
let currentCamPos = new THREE.Vector3(0, 40, 0);

/** @type {THREE.Vector3} 카메라의 목표 위치 벡터 */
let targetCamPos = new THREE.Vector3(0, 40, 0);

/** @type {THREE.Vector3} 카메라의 현재 시선 방향 보간용 벡터 */
let currentCamLook = new THREE.Vector3(0, 0, 0);

/** @type {THREE.Vector3} 카메라의 목표 시선 방향 벡터 */
let targetCamLook = new THREE.Vector3(0, 0, 0);

// ==========================================
// 2. 외부 노출 상수 및 함수 (Exported API)
// ==========================================

/**
 * 카메라 모드 상수
 * - DEFAULT: 중앙을 내려다보는 기본 상태
 * - FOLLOW: 특정 대상이나 위치를 부드럽게 추적하는 상태
 * - ORBITCONTROL: 마우스/터치로 사용자가 자유롭게 카메라를 조작하는 상태
 * - SKILL: 스킬 발동 시 특수한 연출(진동, 줌 등)을 수행하는 상태
 */
export const CAMERA_MODES = {
    DEFAULT: 'DEFAULT',
    FOLLOW: 'FOLLOW',
    ORBITCONTROL: 'ORBITCONTROL',
    SKILL: 'SKILL'
};

/**
 * 카메라 매니저 초기화 함수
 * - 카메라 객체를 생성하고, 씬에 추가하며 OrbitControls를 초기화합니다.
 * @param {THREE.Scene} scene - 카메라가 추가될 Three.js 씬 객체
 * @param {HTMLElement} domElement - OrbitControls가 이벤트를 리스닝할 DOM 요소 (주로 renderer.domElement)
 */
export function initCameraManager(scene, domElement) {
    if (!camera) {
        camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 40, 0);
        camera.lookAt(0, 0, 0);
    }
    
    // 씬에 카메라 추가
    scene.add(camera);

    // OrbitControls 생성
    orbitControls = new OrbitControls(camera, domElement);
    orbitControls.enableDamping = true;
    orbitControls.enabled = false;
    
    // 현재 카메라 상태 초기화
    currentCamPos.copy(camera.position);
    targetCamPos.copy(camera.position);
    currentCamLook.set(0, 0, 0);
    targetCamLook.set(0, 0, 0);

    // 윈도우 리사이즈 대응
    window.addEventListener('resize', () => {
        if (camera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
    });

    setCameraMode(CAMERA_MODES.DEFAULT);
}

/**
 * 카메라의 제어 모드를 설정합니다.
 * - 모드에 따라 OrbitControls의 활성화 여부를 자동으로 제어합니다.
 * @param {string} mode - CAMERA_MODES 중 하나
 * @param {Function} [updater=null] - SKILL 모드일 경우 매 프레임 실행될 업데이트 콜백 함수
 */
export function setCameraMode(mode, updater = null) {
    currentMode = mode;
    customUpdater = updater;

    if (orbitControls) {
        // ORBITCONTROL 모드일 때만 유저 입력을 허용
        orbitControls.enabled = (mode === CAMERA_MODES.ORBITCONTROL);
    }
}

/**
 * FOLLOW 또는 TRANSITION 모드에서 사용할 목표 위치와 시선을 설정합니다.
 * @param {THREE.Vector3} [position] - 카메라가 이동할 목표 위치
 * @param {THREE.Vector3} [lookAt] - 카메라가 바라볼 목표 시점
 */
export function setCameraTarget(position, lookAt) {
    if (position) targetCamPos.copy(position);
    if (lookAt) targetCamLook.copy(lookAt);
}

/**
 * 카메라를 특정 위치와 시점으로 즉시 이동(순간이동)시킵니다.
 * - 모든 보간 상태를 초기화하여 끊김 없이 위치를 고정합니다.
 * @param {THREE.Vector3} [position] - 즉시 이동할 위치
 * @param {THREE.Vector3} [lookAt] - 즉시 바라볼 시점
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
 * 매 프레임 호출되어 카메라의 상태를 업데이트합니다.
 * - 현재 모드에 따라 Lerp 보간, OrbitControls 업데이트, 또는 커스텀 연출을 수행합니다.
 * @param {number} deltaTime - 프레임 간 시간 간격
 */
export function updateCamera(deltaTime) {
    switch (currentMode) {
        case CAMERA_MODES.DEFAULT:
            // 기본 뷰 위치(0, 40, 0) 및 원점(0, 0, 0) 응시로 부드럽게 복귀
            targetCamPos.set(0, 40, 0);
            targetCamLook.set(0, 0, 0);
            
            currentCamPos.lerp(targetCamPos, 0.05);
            currentCamLook.lerp(targetCamLook, 0.05);
            
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
            break;

        case CAMERA_MODES.FOLLOW:
            // 설정된 targetCamPos와 targetCamLook을 향해 부드럽게 보간 이동
            currentCamPos.lerp(targetCamPos, 0.05);
            currentCamLook.lerp(targetCamLook, 0.05);
            
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
            break;

        case CAMERA_MODES.ORBITCONTROL:
            if (orbitControls) {
                orbitControls.update();
                // 사용자가 조작한 위치를 내부 변수에 동기화하여 모드 전환 시 튀는 현상 방지
                currentCamPos.copy(camera.position);
                targetCamPos.copy(camera.position);
            }
            break;

        case CAMERA_MODES.SKILL:
            // 외부(스킬)에서 정의한 특수 카메라 로직 실행
            if (customUpdater) {
                customUpdater(camera, deltaTime);
            }
            break;
    }
}
