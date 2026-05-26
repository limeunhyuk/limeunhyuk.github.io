/**
 * src/skillsVFX.js
 * Role: Visual Effects implementation (Particles, Lights, and Hit animations).
 * Functions:
 * - createHitEffect(position): Spawns particle bursts and light flashes.
 * - updateParticles(): Animates and disposes of active particles.
 * 
 * gameManager doesn't need to consider particles after creation
 * 
 */
import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { scene } from './engine.js';

const particles = [];

export function createHitEffect(position) {
    const particleCount = 40;
    const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
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
    
    const flash = new THREE.PointLight(0xff5500, 5, 10);
    flash.position.copy(position);
    scene.add(flash);
    
    new TWEEN.Tween(flash)
        .to({ intensity: 0 }, 1000)
        .onComplete(() => scene.remove(flash))
        .start();
}

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


export function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.add(p.velocity);
        p.life -= 0.01;
        p.mesh.scale.setScalar(p.life);
        
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
}
