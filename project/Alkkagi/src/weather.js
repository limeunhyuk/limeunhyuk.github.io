/**
 * @file weather.js
 * @description
 * - 3D 환경 내에 렌더링되는 시각적 날씨/환경 효과(눈, 비, 빛무리, 천둥번개 등)를 구현 및 관리
 * - 개별 입자들의 생성과 매 프레임 위치 업데이트를 직접 제어하여 성능을 최적화 (물리 엔진 비사용)
 * - 환경광과 주광의 세기를 조절하여 날씨에 어울리는 분위기(번개 효과 등)를 연출
 */

import * as THREE from 'three';
import { ambientLight, dirLight } from './engine.js';

// ── 비(Rain) 관련 변수 ──
/** @type {THREE.LineSegments} rainLines - 비 입자를 선 형태로 렌더링하는 객체 */
let rainLines;
/** @type {THREE.BufferGeometry} rainGeo - 비 선분들의 정점 데이터 */
let rainGeo;
/** @type {number} rainCount - 비 선분의 개수 */
let rainCount = 25000;
/** @type {Array<Object>} speeds - 각 빗방울의 고유 낙하 속도 및 길이 정보 */
let speeds = [];

// ── 눈(Snow) 관련 변수 ──
/** @type {THREE.Points} snowParticles - 눈 입자를 렌더링하는 파티클 객체 */
let snowParticles;
/** @type {THREE.BufferGeometry} snowGeo - 눈 입자들의 정점 데이터 */
let snowGeo;
/** @type {number} snowCount - 눈 입자의 개수 */
let snowCount = 25000;
/** @type {Array<number>} snowPhases - 눈이 흔들리며 떨어지도록 하는 사인파 위상값 */
let snowPhases = [];

// ── 빛무리(Fireflies) 관련 변수 ──
/** @type {THREE.Points} fireflyParticles - 떠다니는 빛무리를 렌더링하는 파티클 객체 */
let fireflyParticles;
/** @type {THREE.BufferGeometry} fireflyGeo - 빛무리 입자들의 정점 데이터 */
let fireflyGeo;
/** @type {number} fireflyCount - 빛무리 입자의 개수 */
let fireflyCount = 10000;
/** @type {Array<number>} fireflyPhases - 빛무리가 부유하도록 하는 사인파 위상값 */
let fireflyPhases = [];

// ── 현재 날씨 및 이펙트 상태 ──
/** @type {string} currentWeather - 현재 활성화된 날씨 모드 번호 */
let currentWeather = '6';
// 번개 연출을 위해 원래 조명 밝기를 기억해두는 변수
let originalDirIntensity = 0;
let originalAmbIntensity = 0;
let flashTimer = 0;
let isFlashing = false;

/**
 * @function createGlowTexture
 * @description
 * - 파티클(눈, 빛무리)에 부드러운 발광 효과를 주기 위한 원형 그라데이션 텍스처를 캔버스로 동적 생성
 * @returns {THREE.CanvasTexture} 생성된 발광 텍스처
 */
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    
    // 중심이 하얗고 바깥으로 갈수록 투명해지는 방사형 그라데이션
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    
    return new THREE.CanvasTexture(canvas);
}

/**
 * @function initWeather
 * @description
 * - 게임 시작 시 모든 날씨 입자(눈, 비, 빛무리)의 지오메트리 및 재질을 초기 생성하여 씬에 추가
 * - 초기 상태는 모두 숨김(visible = false)으로 설정
 * @param {THREE.Scene} scene - 파티클들을 추가할 메인 씬
 */
export function initWeather(scene) {
    const glowTex = createGlowTexture();
    
    // === 비 (Rain) ===
    // 점이 아닌 선분(LineSegments)으로 렌더링하여 빗줄기를 표현
    rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 6);
    
    for (let i = 0; i < rainCount; i++) {
        let x, z;
        // 반경 135 내부 원형 영역에만 무작위 분산
        do {
            x = Math.random() * 270 - 135;
            z = Math.random() * 270 - 135;
        } while (x*x + z*z > 135*135);
        
        const y = Math.random() * 55 - 5;
        const length = Math.random() * 0.5 + 0.3;
        const speed = Math.random() * 15 + 25;

        // 선분의 시작점과 끝점 지정
        rainPositions[i * 6] = x;
        rainPositions[i * 6 + 1] = y;
        rainPositions[i * 6 + 2] = z;
        rainPositions[i * 6 + 3] = x;
        rainPositions[i * 6 + 4] = y - length;
        rainPositions[i * 6 + 5] = z;
        
        speeds.push({ speed, length });
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
    rainLines = new THREE.LineSegments(rainGeo, rainMaterial);
    rainLines.frustumCulled = false; // 화면 밖에 나가도 연산 유지
    rainLines.visible = false;
    scene.add(rainLines);

    // === 눈 (Snow) ===
    // 가산 혼합(Additive Blending)을 사용하여 입자들이 겹칠수록 밝게 빛나도록 설정
    snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
        let x, z;
        do {
            x = Math.random() * 270 - 135;
            z = Math.random() * 270 - 135;
        } while (x*x + z*z > 135*135);
        
        const y = Math.random() * 55 - 5;
        snowPositions[i * 3] = x;
        snowPositions[i * 3 + 1] = y;
        snowPositions[i * 3 + 2] = z;
        snowPhases.push(Math.random() * Math.PI * 2);
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.4,
        map: glowTex,
        transparent: true,
        opacity: 0.8,
        depthWrite: false, // 투명도 정렬 이슈 방지
        blending: THREE.AdditiveBlending
    });
    snowParticles = new THREE.Points(snowGeo, snowMat);
    snowParticles.frustumCulled = false;
    snowParticles.visible = false;
    scene.add(snowParticles);

    // === 빛무리 (Fireflies) ===
    // 눈과 유사하지만 크기가 크고 느리게 떠오르는 녹색 빛
    fireflyGeo = new THREE.BufferGeometry();
    const fireflyPositions = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
        let x, z;
        do {
            x = Math.random() * 270 - 135;
            z = Math.random() * 270 - 135;
        } while (x*x + z*z > 135*135);
        
        const y = Math.random() * 55 - 5;
        fireflyPositions[i * 3] = x;
        fireflyPositions[i * 3 + 1] = y;
        fireflyPositions[i * 3 + 2] = z;
        fireflyPhases.push(Math.random() * Math.PI * 2);
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
    const fireflyMat = new THREE.PointsMaterial({
        color: 0xaaffaa,
        size: 1.2,
        map: glowTex,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    fireflyParticles = new THREE.Points(fireflyGeo, fireflyMat);
    fireflyParticles.frustumCulled = false;
    fireflyParticles.visible = false;
    scene.add(fireflyParticles);
}

/**
 * @function setWeather
 * @description
 * - 입력된 번호에 따라 씬에 그려질 특정 날씨 객체만 보이도록 켜고 나머지는 숨김
 * - 번개 이펙트 중 취소될 경우 조명 밝기를 강제로 원래대로 복구
 * @param {string} type - '6'(맑음), '7'(비), '8'(눈), '9'(빛무리), '0'(천둥)
 */
export function setWeather(type) {
    currentWeather = type;
    rainLines.visible = (type === '7' || type === '0');
    snowParticles.visible = (type === '8');
    fireflyParticles.visible = (type === '9');

    // 천둥번개 모드가 해제되었을 때 깜빡이던 조명을 원상 복구
    if (type !== '0') {
        if (dirLight && ambientLight && isFlashing) {
            dirLight.intensity = originalDirIntensity;
            ambientLight.intensity = originalAmbIntensity;
        }
        isFlashing = false;
    }
}

/**
 * @function updateWeather
 * @description
 * - 매 프레임마다 활성화된 날씨 객체 내부의 수만 개 정점(Vertex) 위치를 직접 재계산하여 업데이트
 * - 비/눈/빛무리 각각의 물리적 성질(낙하, 흔들림, 떠오름)을 수학적으로 시뮬레이션
 * @param {number} deltaTime - 프레임 간 델타 타임
 */
export function updateWeather(deltaTime) {
    const time = Date.now() * 0.001;

    // 비(Rain) 및 천둥번개(Thunderstorm) 모션 업데이트
    if (currentWeather === '7' || currentWeather === '0') {
        const positions = rainGeo.attributes.position.array;
        for (let i = 0; i < rainCount; i++) {
            // y축 아래 방향으로 일직선 낙하
            positions[i * 6 + 1] -= speeds[i].speed * deltaTime;
            positions[i * 6 + 4] -= speeds[i].speed * deltaTime;

            // 바닥 밑으로 떨어지면 하늘 위로 재배치 (무한루프)
            if (positions[i * 6 + 1] < -5) {
                positions[i * 6 + 1] = 50;
                positions[i * 6 + 4] = 50 - speeds[i].length;
            }
        }
        rainGeo.attributes.position.needsUpdate = true; // GPU에 데이터 갱신 알림

        // 번개 번쩍임(Flash) 연출
        if (currentWeather === '0') {
            if (flashTimer <= 0) {
                if (!isFlashing) {
                    // 번쩍 켤 때
                    originalDirIntensity = dirLight.intensity;
                    originalAmbIntensity = ambientLight.intensity;
                    dirLight.intensity = originalDirIntensity * 4;
                    ambientLight.intensity = originalAmbIntensity * 4;
                    isFlashing = true;
                    flashTimer = 0.1; 
                } else {
                    // 번쩍 끈 뒤 대기
                    dirLight.intensity = originalDirIntensity;
                    ambientLight.intensity = originalAmbIntensity;
                    isFlashing = false;
                    flashTimer = Math.random() * 5 + 2; 
                }
            } else {
                flashTimer -= deltaTime;
            }
        }
    }

    // 눈(Snow) 모션 업데이트
    if (currentWeather === '8') {
        const positions = snowGeo.attributes.position.array;
        for (let i = 0; i < snowCount; i++) {
            // y축 낙하와 동시에 x, z축으로 사인파(sin, cos)를 그리며 흩날리게 연출
            positions[i * 3 + 1] -= deltaTime * 3.0; 
            positions[i * 3] += Math.sin(time + snowPhases[i]) * deltaTime * 1.5;
            positions[i * 3 + 2] += Math.cos(time + snowPhases[i]) * deltaTime * 1.5;

            // 바닥에 닿으면 하늘 위로 재배치
            if (positions[i * 3 + 1] < -5) {
                positions[i * 3 + 1] = 50;
            }
        }
        snowGeo.attributes.position.needsUpdate = true;
    }

    // 빛무리(Fireflies) 모션 업데이트
    if (currentWeather === '9') {
        const positions = fireflyGeo.attributes.position.array;
        for (let i = 0; i < fireflyCount; i++) {
            // 눈과 반대로 y축 위로 천천히 떠오름
            positions[i * 3 + 1] += deltaTime * 1.5; 
            positions[i * 3] += Math.sin(time * 0.5 + fireflyPhases[i]) * deltaTime * 1.0;
            positions[i * 3 + 2] += Math.cos(time * 0.5 + fireflyPhases[i]) * deltaTime * 1.0;

            // 하늘 끝까지 올라가면 바닥 밑으로 재배치
            if (positions[i * 3 + 1] > 50) {
                positions[i * 3 + 1] = -5;
            }
        }
        fireflyGeo.attributes.position.needsUpdate = true;
    }
}