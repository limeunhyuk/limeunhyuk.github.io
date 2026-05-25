/**
 * src/gameManager.js
 * Role: Main Render and Physics Loop orchestration (Game Manager).
 * Functions:
 * - animate(time): Coordinates physics stepping, camera interpolation, and rendering.
 * - handleMovingPhase(): Logic for camera tracking and slow-mo during movement.
 * - handleCollisionEvents(): Processes physics collisions and triggers skills.
 * - handleMiniGamePhase(): Specialized camera work for the mini-game.
 * - updateCamera(): Interpolates camera position and lookAt.
 */
import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { renderer, scene, camera, physicsWorld, eventQueue, updateMeshPositions } from './engine.js';
import { state } from './state.js';
import { objects, checkFallOffBoard } from './stone.js';
import { skillManager } from './SkillManager.js';
import { RhythmSkill } from './skills/RhythmSkill.js';
import { updateParticles } from './skillsVFX.js';
import { shrinkingRing, showGameOver } from './ui.js';

let lastTime = 0;

export function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    TWEEN.update(time);
    state.frameCount++;

    handleGameStateLogic();
    skillManager.updateVFX(deltaTime); 
    updateParticles();
    updateRhythmUI();
    
    renderer.render(scene, camera);
}

function handleGameStateLogic() {
    if (state.gameState === "MOVING" || state.gameState === "AIMING" || state.gameState === "GAMEOVER") {
        let targetSlowMo = 1.0;

        if (state.gameState === "MOVING") {
            targetSlowMo = handleMovingPhase();
        }

        state.currentSlowMoFactor += (targetSlowMo - state.currentSlowMoFactor) * 0.1;
        updateCamera();

        // Sync physics to Three.js
        objects.forEach(obj => { if (obj.active) obj.prevLinvel = { ...obj.body.linvel() }; });
        physicsWorld.timestep = (1.0 / 60.0) * Math.max(0.01, state.currentSlowMoFactor);
        physicsWorld.step(eventQueue);

        if (state.gameState === "MOVING") {
            handleCollisionEvents();
            checkMovementStopped();
        }
        
        updateMeshPositions(objects);
        checkFallOffBoard(showGameOver);

    } else if (state.gameState === "ZOOMING_IN" || state.gameState === "ZOOMING_OUT" || state.gameState === "MINIGAME" || state.gameState === "RETURN_TO_AIM") {
        if (state.gameState === "MINIGAME") {
            handleMiniGamePhase();
        } else {
            updateCamera();
        }
    }
}

function handleMovingPhase() {
    let targetSlowMo = 1.0;
    state.targetCamPos = { x: 0, y: 40, z: 0 };
    state.targetCamLook = { x: 0, y: 0, z: 0 };

    if (!state.firstCollisionOccurred) {
        let minDistanceSq = 9999;
        let closestPair = null;

        // Lock-on logic
        if (state.lockedPair && state.lockedPair[0].active && state.lockedPair[1].active) {
            const v1 = state.lockedPair[0].body.linvel();
            const v2 = state.lockedPair[1].body.linvel();
            const isMoving = (v1.x*v1.x + v1.z*v1.z > 0.5) || (v2.x*v2.x + v2.z*v2.z > 0.5);
            const distSq = state.lockedPair[0].mesh.position.distanceToSquared(state.lockedPair[1].mesh.position);
            if (isMoving && distSq < 25.0) {
                minDistanceSq = distSq;
                closestPair = state.lockedPair;
            } else {
                state.lockedPair = null;
            }
        }

        if (!state.lockedPair) {
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
            if (minDistanceSq < 16.0 && closestPair) state.lockedPair = closestPair;
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
            state.targetCamLook = { x: midPoint.x, y: midPoint.y, z: midPoint.z };
            
            const finalCamPos = new THREE.Vector3(midPoint.x * 0.3, 22, midPoint.z * 0.3 + 15);
            const startCamPos = new THREE.Vector3(0, 40, 0);
            const lerpedCamPos = new THREE.Vector3().lerpVectors(finalCamPos, startCamPos, Math.pow(distFactor, 1.2));
            state.targetCamPos = { x: lerpedCamPos.x, y: lerpedCamPos.y, z: lerpedCamPos.z };
        } else {
            state.lockedPair = null;
        }
    }
    return targetSlowMo;
}

function handleCollisionEvents() {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        if (started) {
            const obj1 = objects.find(o => o.body.handle === handle1);
            const obj2 = objects.find(o => o.body.handle === handle2);
            if (obj1 && obj2 && obj1.type === 'stone' && obj2.type === 'stone') {
                if (!state.firstCollisionOccurred) {
                    state.firstCollisionOccurred = true;
                    
                    const midPoint = new THREE.Vector3().addVectors(obj1.mesh.position, obj2.mesh.position).multiplyScalar(0.5);
                    skillManager.handleCollision(obj1, obj2, midPoint);
                }
            }
        }
    });
}

function checkMovementStopped() {
    let movingCount = 0;
    objects.forEach((obj) => {
        if (obj.active) {
            const linVel = obj.body.linvel();
            if (Math.sqrt(linVel.x*linVel.x + linVel.z*linVel.z) > 0.1) movingCount++;
        }
    });

    if (movingCount === 0) {
        state.gameState = "RETURN_TO_AIM";
        state.currentSlowMoFactor = 1.0;
        state.lockedPair = null;

        new TWEEN.Tween(state.currentCamPos)
            .to({ x: 0, y: 40, z: 0 }, 800)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();

        new TWEEN.Tween(state.currentCamLook)
            .to({ x: 0, y: 0, z: 0 }, 800)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                state.gameState = "AIMING";
                const selector = document.getElementById('skill-selector');
                if (selector) selector.style.display = 'block';
            })
            .start();
    }
}

function handleMiniGamePhase() {
    if (window.currentFightScene) {
        const midPoint = new THREE.Vector3().addVectors(
            window.currentFightScene.attackerStone.mesh.position, 
            window.currentFightScene.defenderStone.mesh.position
        ).multiplyScalar(0.5);
        
        const radius = Math.sqrt(Math.pow(state.currentCamPos.x - midPoint.x, 2) + Math.pow(state.currentCamPos.z - midPoint.z, 2));
        const currentAngle = Math.atan2(state.currentCamPos.z - midPoint.z, state.currentCamPos.x - midPoint.x);
        const newAngle = currentAngle + 0.005; 
        
        state.currentCamPos.x = midPoint.x + Math.cos(newAngle) * radius;
        state.currentCamPos.z = midPoint.z + Math.sin(newAngle) * radius;
        state.currentCamLook = { x: midPoint.x, y: midPoint.y, z: midPoint.z };
        
        updateCamera(true); // Immediate update
    }
}

function updateCamera(immediate = false) {
    if (!immediate && (state.gameState === "MOVING" || state.gameState === "RETURN_TO_AIM" || state.gameState === "ZOOMING_IN" || state.gameState === "ZOOMING_OUT")) {
        const currentCamPosVec = new THREE.Vector3(state.currentCamPos.x, state.currentCamPos.y, state.currentCamPos.z);
        const targetCamPosVec = new THREE.Vector3(state.targetCamPos.x, state.targetCamPos.y, state.targetCamPos.z);
        currentCamPosVec.lerp(targetCamPosVec, 0.05);
        state.currentCamPos = { x: currentCamPosVec.x, y: currentCamPosVec.y, z: currentCamPosVec.z };

        const currentCamLookVec = new THREE.Vector3(state.currentCamLook.x, state.currentCamLook.y, state.currentCamLook.z);
        const targetCamLookVec = new THREE.Vector3(state.targetCamLook.x, state.targetCamLook.y, state.targetCamLook.z);
        currentCamLookVec.lerp(targetCamLookVec, 0.05);
        state.currentCamLook = { x: currentCamLookVec.x, y: currentCamLookVec.y, z: currentCamLookVec.z };
    }

    camera.position.lerp(state.currentCamPos, 0.99);
    camera.lookAt(state.currentCamLook.x, state.currentCamLook.y, state.currentCamLook.z);
}

function updateRhythmUI() {
    if (state.rhythmActive) {
        state.ringSize -= state.rhythmSpeed;
        if (state.ringSize < 40) { 
            RhythmSkill.checkRhythmTiming();
        } else if (shrinkingRing) {
            shrinkingRing.style.width = state.ringSize + 'px';
            shrinkingRing.style.height = state.ringSize + 'px';
        }
    }
}
