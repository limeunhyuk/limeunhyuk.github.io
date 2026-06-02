/**
 * @file engine.js
 * @description
 * - 3D 렌더링(Three.js) 및 물리 연산(Rapier) 엔진의 초기화 및 설정 담당
 * - 씬(Scene), 렌더러(Renderer), 물리 세계(World) 등 코어 객체를 전역적으로 관리
 * - 조명 및 그림자 품질에 대한 핵심 설정 포함
 */

import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

/** @type {THREE.Scene} scene - 3D 객체들이 배치되는 논리적 공간 */
export let scene;
/** @type {THREE.WebGLRenderer} renderer - 화면에 3D 씬을 그리는 렌더러 */
export let renderer;
/** @type {RAPIER.World} physicsWorld - 물리 법칙(중력, 충돌 등)이 시뮬레이션되는 공간 */
export let physicsWorld;
/** @type {RAPIER.EventQueue} eventQueue - 충돌 등 물리 엔진에서 발생하는 이벤트를 수집하는 큐 */
export let eventQueue;
/** @type {THREE.AmbientLight} ambientLight - 씬 전체를 부드럽게 밝혀주는 기본 조명 */
export let ambientLight;
/** @type {THREE.DirectionalLight} dirLight - 그림자를 생성하고 입체감을 주는 주 조명(태양광) */
export let dirLight;

/**
 * @function initEngine
 * @description
 * - 물리 엔진(Rapier) 로드 및 초기화
 * - Three.js 씬 및 WebGL 렌더러 생성
 * - 화면 크기에 맞춘 렌더러 세팅 및 리사이즈 이벤트 바인딩
 * - 조명(Ambient, Directional) 및 그림자 맵 정밀도 설정
 * @returns {Promise<void>}
 */
export async function initEngine() {
    await RAPIER.init();
    physicsWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    eventQueue = new RAPIER.EventQueue();

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 2.8);
    dirLight.position.set(20, 20, 0);
    dirLight.castShadow = true;
    
    // 그림자 품질 최적화 세팅
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.008;
    
    // 넓은 바둑판과 책상을 모두 덮을 수 있는 충분한 그림자 카메라 영역 설정
    const shadowSize = 35;
    dirLight.shadow.camera.left = -shadowSize;
    dirLight.shadow.camera.right = shadowSize;
    dirLight.shadow.camera.top = shadowSize;
    dirLight.shadow.camera.bottom = -shadowSize;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    scene.add(dirLight);

    // 창 크기 변경 시 해상도 동기화
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

/**
 * @function updateMeshPositions
 * @description
 * - 물리 엔진의 연산 결과(위치, 회전)를 시각적인 3D 메쉬에 동기화
 * - 활성화(active)된 객체만 추적하여 최적화
 * @param {Array<Object>} objects - 동기화할 대상 객체 배열 (바둑돌 등)
 */
export function updateMeshPositions(objects) {
    objects.forEach((obj) => {
        if (obj.active) {
            const pos = obj.body.translation();
            const rot = obj.body.rotation();
            obj.mesh.position.set(pos.x, pos.y, pos.z);
            obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        }
    });
}

/**
 * @function setBrightness
 * @description
 * - 게임 화면의 전체적인 밝기 수준 조절
 * - 키보드 숫자 키 입력(1~5)에 따라 환경광과 주광의 강도를 비례하여 변경
 * @param {number} level - 설정할 밝기 단계 (1 ~ 5)
 */
export function setBrightness(level) {
    if (ambientLight && dirLight) {
        ambientLight.intensity = 0.6 * (level / 3);
        dirLight.intensity = 0.8 * (level / 3);
    }
}
