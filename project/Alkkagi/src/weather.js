/**
 * src/weather.js
 * Weather effects: Rain, Snow, Fireflies, Thunderstorm
 */
import * as THREE from 'three';
import { ambientLight, dirLight } from './engine.js';

let rainLines;
let rainGeo;
let rainCount = 25000;
let speeds = [];

let snowParticles;
let snowGeo;
let snowCount = 25000;
let snowPhases = [];

let fireflyParticles;
let fireflyGeo;
let fireflyCount = 10000;
let fireflyPhases = [];

let currentWeather = '6';

let originalDirIntensity = 0;
let originalAmbIntensity = 0;
let flashTimer = 0;
let isFlashing = false;

// 원형 발광 텍스처 생성기
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    
    return new THREE.CanvasTexture(canvas);
}

export function initWeather(scene) {
    const glowTex = createGlowTexture();
    
    // === 비 (Rain) ===
    rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 6);
    
    for (let i = 0; i < rainCount; i++) {
        let x, z;
        do {
            x = Math.random() * 270 - 135;
            z = Math.random() * 270 - 135;
        } while (x*x + z*z > 135*135);
        
        const y = Math.random() * 55 - 5;
        const length = Math.random() * 0.5 + 0.3;
        const speed = Math.random() * 15 + 25;

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
    rainLines.frustumCulled = false;
    rainLines.visible = false;
    scene.add(rainLines);

    // === 눈 (Snow) ===
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
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    snowParticles = new THREE.Points(snowGeo, snowMat);
    snowParticles.frustumCulled = false;
    snowParticles.visible = false;
    scene.add(snowParticles);

    // === 빛무리 (Fireflies) ===
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

export function setWeather(type) {
    currentWeather = type;
    rainLines.visible = (type === '7' || type === '0');
    snowParticles.visible = (type === '8');
    fireflyParticles.visible = (type === '9');

    if (type !== '0') {
        if (dirLight && ambientLight && isFlashing) {
            dirLight.intensity = originalDirIntensity;
            ambientLight.intensity = originalAmbIntensity;
        }
        isFlashing = false;
    }
}

export function updateWeather(deltaTime) {
    const time = Date.now() * 0.001;

    // Rain / Thunderstorm
    if (currentWeather === '7' || currentWeather === '0') {
        const positions = rainGeo.attributes.position.array;
        for (let i = 0; i < rainCount; i++) {
            positions[i * 6 + 1] -= speeds[i].speed * deltaTime;
            positions[i * 6 + 4] -= speeds[i].speed * deltaTime;

            if (positions[i * 6 + 1] < -5) {
                positions[i * 6 + 1] = 50;
                positions[i * 6 + 4] = 50 - speeds[i].length;
            }
        }
        rainGeo.attributes.position.needsUpdate = true;

        if (currentWeather === '0') {
            if (flashTimer <= 0) {
                if (!isFlashing) {
                    originalDirIntensity = dirLight.intensity;
                    originalAmbIntensity = ambientLight.intensity;
                    dirLight.intensity = originalDirIntensity * 4;
                    ambientLight.intensity = originalAmbIntensity * 4;
                    isFlashing = true;
                    flashTimer = 0.1; // Flash duration
                } else {
                    dirLight.intensity = originalDirIntensity;
                    ambientLight.intensity = originalAmbIntensity;
                    isFlashing = false;
                    flashTimer = Math.random() * 5 + 2; // Next flash in 2-7s
                }
            } else {
                flashTimer -= deltaTime;
            }
        }
    }

    // Snow
    if (currentWeather === '8') {
        const positions = snowGeo.attributes.position.array;
        for (let i = 0; i < snowCount; i++) {
            positions[i * 3 + 1] -= deltaTime * 3.0; // fall speed
            positions[i * 3] += Math.sin(time + snowPhases[i]) * deltaTime * 1.5;
            positions[i * 3 + 2] += Math.cos(time + snowPhases[i]) * deltaTime * 1.5;

            if (positions[i * 3 + 1] < -5) {
                positions[i * 3 + 1] = 50;
            }
        }
        snowGeo.attributes.position.needsUpdate = true;
    }

    // Fireflies
    if (currentWeather === '9') {
        const positions = fireflyGeo.attributes.position.array;
        for (let i = 0; i < fireflyCount; i++) {
            positions[i * 3 + 1] += deltaTime * 1.5; // rise speed
            positions[i * 3] += Math.sin(time * 0.5 + fireflyPhases[i]) * deltaTime * 1.0;
            positions[i * 3 + 2] += Math.cos(time * 0.5 + fireflyPhases[i]) * deltaTime * 1.0;

            if (positions[i * 3 + 1] > 50) {
                positions[i * 3 + 1] = -5;
            }
        }
        fireflyGeo.attributes.position.needsUpdate = true;
    }
}