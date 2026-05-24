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

export const objects = [];

export function clearStones() {
    objects.forEach(obj => {
        scene.remove(obj.mesh);
        physicsWorld.removeRigidBody(obj.body);
    });
    objects.length = 0;
}

export function createStones(bCount, wCount) {
    clearStones();
    
    state.totalBlack = bCount;
    state.totalWhite = wCount;
    state.currentBlack = bCount;
    state.currentWhite = wCount;
    
    const positions = [];
    
    // 흑돌 배치
    for(let i=0; i<bCount; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const xOffset = row % 2 === 1 ? 1.0 : 0.0;
        positions.push({ x: -4 + col * 2.0 + xOffset, z: 6 - row, color: 'black' });
    }
    
    // 백돌 배치
    for(let i=0; i<wCount; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const xOffset = row % 2 === 1 ? 1.0 : 0.0;
        positions.push({ x: -4 + col * 2.0 + xOffset, z: -6 + row, color: 'white' });
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
        
        const colliderDesc = RAPIER.ColliderDesc.cylinder(height/2, radius)
            .setRestitution(0.9)
            .setFriction(0.3)
            .setDensity(1.0)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
            
        physicsWorld.createCollider(colliderDesc, body);

        objects.push({ mesh, body, type: 'stone', color: pos.color, active: true });
    });
}

export function checkFallOffBoard(onGameOver) {
    if (state.gameState === "MENU" || state.gameState === "GAMEOVER") return;

    objects.forEach(obj => {
        if (obj.active) {
            const pos = obj.body.translation();
            if (pos.y < -1.0) {
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
