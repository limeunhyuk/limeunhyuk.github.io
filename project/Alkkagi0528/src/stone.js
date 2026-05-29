/**
 * src/stone.js
 * Role: Stone Management (Spawning, Removal, and Fall-off detection).
 * Functions:
 * - createStones(bCount, wCount): Spawns and configures black and white stones.
 * - clearStones(): Disposes of all stone meshes and physics bodies.
 * - checkFallOffBoard(onGameOver): Monitors and handles stones falling off the board.
 */
import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { scene, physicsWorld } from './engine.js';
import { assets } from './assets.js';
import { state } from './state.js';
import { updateStatusUI } from './ui.js';
import { createFallEffect } from './skillsVFX.js';

export const objects = [];

export function clearStones() {
    objects.forEach(obj => {
        scene.remove(obj.mesh);
        physicsWorld.removeRigidBody(obj.body);
    });
    objects.length = 0;
}

/**
 * @param {number} bCount - 흑돌 수
 * @param {number} wCount - 백돌 수
 * @param {Array<{x:number,z:number}>|null} bPositions - 흑돌 좌표 배열 (null이면 기본 배치)
 * @param {Array<{x:number,z:number}>|null} wPositions - 백돌 좌표 배열 (null이면 기본 배치)
 */
export function createStones(bCount, wCount, bPositions = null, wPositions = null) {
    clearStones();

    state.totalBlack = bCount;
    state.totalWhite = wCount;
    state.currentBlack = bCount;
    state.currentWhite = wCount;

    const positions = [];

    if (bPositions && wPositions) {
        // 포진 선택으로 전달된 좌표 사용
        bPositions.forEach(p => positions.push({ x: p.x, z: p.z, color: 'black' }));
        wPositions.forEach(p => positions.push({ x: p.x, z: p.z, color: 'white' }));
    } else {
        // 기본 배치 (fallback)
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
    
    const blackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.1, clearcoat: 0.5 });
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xeeeeee, roughness: 0.1, clearcoat: 0.5 });

    positions.forEach(pos => {
        let mesh;
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

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, 0.125, pos.z)
            .setLinearDamping(2.0)
            .setAngularDamping(2.0);
            
        const body = physicsWorld.createRigidBody(bodyDesc);
        
        // 충돌 그룹: (memberships << 16) | filter
        // 흑돌 = 그룹 1 (0x0001), 백돌 = 그룹 2 (0x0002)
        // 필터 0xFFFF → 모든 그룹과 충돌 (돌끼리, 바닥, 벽 모두)
        const stoneGroup = pos.color === 'black'
            ? (0x0001 << 16) | 0xFFFF   // 흑돌: member=1, 모든 것과 충돌
            : (0x0002 << 16) | 0xFFFF;  // 백돌: member=2, 모든 것과 충돌

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

export function checkFallOffBoard(onGameOver) {
    if (state.gameState === "MENU" || state.gameState === "GAMEOVER") return;

    objects.forEach(obj => {
        if (obj.active) {
            const pos = obj.body.translation();
            // 바둑판(크기 15)을 벗어났는지 확인 (가장자리 7.5에서 시각적으로 적절히 벗어난 10.0 지점)
            const isOffHorizontally = Math.abs(pos.x) > 10.0 || Math.abs(pos.z) > 10.0;
            const isOffVertically = pos.y < -1.0;

            if (isOffHorizontally || isOffVertically) {
                // 바닥 밑에서 이펙트가 터져서 가려지지 않도록 높이 보정
                const effectY = Math.max(-0.4, pos.y);
                const fallPos = new THREE.Vector3(pos.x, effectY, pos.z);
                createFallEffect(fallPos);
                
                obj.active = false;
                obj.mesh.visible = false;
                
                obj.body.setTranslation({ x: 0, y: -100, z: 0 }, true);
                
                if (obj.color === 'black') state.currentBlack--;
                if (obj.color === 'white') state.currentWhite--;
                
                updateStatusUI();
            }
        }
    });

    if (state.currentBlack === 0 && state.currentWhite > 0) {
        onGameOver("white");
    } else if (state.currentWhite === 0 && state.currentBlack > 0) {
        onGameOver("black");
    } else if (state.currentBlack === 0 && state.currentWhite === 0) {
        onGameOver("draw");
    }
}


