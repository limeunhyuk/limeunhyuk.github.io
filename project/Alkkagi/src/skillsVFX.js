/**
 * @file skillsVFX.js
 * @description
 * - 스킬 사용, 돌 간 충돌, 지뢰 폭발 등 게임 내 주요 이벤트에 대한 시각적 파티클 효과(VFX) 구현
 * - Three.js의 메쉬 기반 파티클 배열과 TWEEN 라이브러리를 활용해 광원(PointLight) 애니메이션 제어
 * - gameManager 등 다른 모듈에서는 파티클 생성 함수만 호출하고, 소멸 관리는 이 모듈 내부(updateParticles)에서 알아서 처리함
 */

import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { scene } from './engine.js';

/**
 * @type {Array<Object>} particles
 * @description 생성된 모든 파티클(mesh, velocity, life)을 담는 배열. 수명이 다하면 제거됨.
 */
const particles = [];

/**
 * @function createHitEffect
 * @description
 * - 바둑돌끼리 일반 충돌 시 주황색/노란색 파티클이 사방으로 흩어지는 효과
 * - 짧고 강한 플래시 조명 동반
 * @param {THREE.Vector3} position - 이펙트가 발생할 3D 좌표
 */
export function createHitEffect(position) {
    const particleCount = 40;
    const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // 구면 좌표계를 이용해 사방으로 퍼지는 무작위 벡터 계산
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 0.01 + Math.random() * 0.02;
        
        const velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).multiplyScalar(speed);

        scene.add(mesh);
        particles.push({ mesh, velocity, life: 1.0 });
    }
    
    // 타격 순간의 빛 번쩍임 효과 (PointLight)
    const flash = new THREE.PointLight(0xff5500, 5, 10);
    flash.position.copy(position);
    scene.add(flash);
    
    // TWEEN 애니메이션: 빛의 강도를 1초 동안 서서히 0으로 감소시키고 제거
    new TWEEN.Tween(flash)
        .to({ intensity: 0 }, 1000)
        .onComplete(() => scene.remove(flash))
        .start();
}

/**
 * @function createFallEffect
 * @description
 * - 바둑돌이 보드 밖(낭떠러지)으로 떨어질 때 발생하는 파티클 효과 (하늘색/청록색 톤)
 * @param {THREE.Vector3} position - 이펙트가 발생할 3D 좌표
 */
export function createFallEffect(position) {
    const particleCount = 30;
    const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const material = new THREE.MeshBasicMaterial({ color: 0x87ceeb }); // 하늘색

    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 0.02 + Math.random() * 0.03;
        
        const velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).multiplyScalar(speed);

        scene.add(mesh);
        particles.push({ mesh, velocity, life: 1.0 });
    }
    
    const flash = new THREE.PointLight(0x00ffff, 4, 8);
    flash.position.copy(position);
    scene.add(flash);
    
    new TWEEN.Tween(flash)
        .to({ intensity: 0 }, 800)
        .onComplete(() => scene.remove(flash))
        .start();
}

/**
 * @function createExplosionEffect
 * @description
 * - 지뢰 폭발(MineSkill) 등 거대한 타격이 발생했을 때 생성되는 붉은 화염 파티클 폭발 효과
 * @param {THREE.Vector3} position - 이펙트가 발생할 3D 좌표
 */
export function createExplosionEffect(position) {
    const particleCount = 80;
    const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const material = new THREE.MeshBasicMaterial({ color: 0xff4400 });

    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(Math.random() * 2 - 1);
        const speed = 0.03 + Math.random() * 0.05;

        const velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).multiplyScalar(speed);

        scene.add(mesh);
        particles.push({ mesh, velocity, life: 1.0 });
    }

    const flash = new THREE.PointLight(0xff4400, 15, 18);
    flash.position.copy(position);
    scene.add(flash);

    new TWEEN.Tween(flash)
        .to({ intensity: 0 }, 1500)
        .onComplete(() => scene.remove(flash))
        .start();
}

/**
 * @function createElectricEffect
 * @description
 * - 순간이동 스킬(상대방 텔레포트, 강제 이동 등)에 사용되는 보라/푸른빛의 마법(전기) 이펙트
 * @param {THREE.Vector3} position - 이펙트가 발생할 3D 좌표
 */
export function createElectricEffect(position) {
    const particleCount = 50;
    const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const material = new THREE.MeshBasicMaterial({ color: 0xaa33ff });

    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(Math.random() * 2 - 1);
        const speed = 0.02 + Math.random() * 0.04;

        const velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).multiplyScalar(speed);

        scene.add(mesh);
        particles.push({ mesh, velocity, life: 1.0 });
    }

    const flash = new THREE.PointLight(0xaa33ff, 8, 12);
    flash.position.copy(position);
    scene.add(flash);

    new TWEEN.Tween(flash)
        .to({ intensity: 0 }, 1200)
        .onComplete(() => scene.remove(flash))
        .start();
}

/**
 * @function updateParticles
 * @description
 * - 매 렌더링 프레임(engine.js 루프)마다 호출되어 모든 파티클의 이동 및 수명 갱신
 * - 수명이 0 이하가 된 파티클 메쉬는 씬에서 제거하고 배열에서도 삭제함
 */
export function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.add(p.velocity); // 속도만큼 이동
        p.life -= 0.01;                  // 수명 감소
        p.mesh.scale.setScalar(p.life);  // 남은 수명만큼 크기 축소 (점점 작아짐)
        
        // 수명이 다하면 제거
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
}
