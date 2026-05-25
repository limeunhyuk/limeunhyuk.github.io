/**
 * src/gameManager.js
 * Role: Main Render and Physics Loop orchestration (Game Manager).
 * Functions:
 * - animate(time): Coordinates physics stepping, camera interpolation, and rendering.
 * - handleGameStateLogic(deltaTime): Main switch for different game phases.
 * - handleCollisionEvents(): Processes physics collisions and triggers skills.
 * - checkMovementStopped(): Detects turn end and triggers cleanup.
 */
import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { renderer, scene, physicsWorld, eventQueue, updateMeshPositions } from './engine.js';
import { state } from './state.js';
import { objects, checkFallOffBoard } from './stone.js';
import { skillManager } from './SkillManager.js';
import { RhythmSkill } from './skills/RhythmSkill.js';
import { updateParticles } from './skillsVFX.js';
import { shrinkingRing, showGameOver } from './ui.js';
import { updateCamera as updateCameraLogic, setCameraMode, CAMERA_MODES, getCamera, updateActionCamera } from './cameraManager.js';

let lastTime = 0;

export function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    TWEEN.update(time);
    state.frameCount++;

    handleGameStateLogic(deltaTime);
    skillManager.updateVFX(deltaTime); 
    updateParticles();
    
    renderer.render(scene, getCamera());
}

function handleGameStateLogic(deltaTime) {
    if (state.gameState === "MOVING" || state.gameState === "AIMING" || state.gameState === "GAMEOVER") {
        let targetSlowMo = 1.0;

        if (state.gameState === "MOVING") {
            const cameraResult = updateActionCamera(objects, state.lockedPair, state.firstCollisionOccurred);
            targetSlowMo = cameraResult.targetSlowMo;
            state.lockedPair = cameraResult.newLockedPair;
        }

        state.currentSlowMoFactor += (targetSlowMo - state.currentSlowMoFactor) * 0.1;
        updateCameraLogic(deltaTime);

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
        updateCameraLogic(deltaTime);
    }
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

        // Turn end cleanup for skills
        skillManager.resetTurn();

        // Camera Manager의 DEFAULT 모드로 전환하여 부드럽게 복귀
        setCameraMode(CAMERA_MODES.DEFAULT);
        
        // 상태 전환을 위한 지연 처리 (lerp가 어느 정도 완료된 후)
        setTimeout(() => {
            if (state.gameState === "RETURN_TO_AIM") {
                state.gameState = "AIMING";
                setCameraMode(CAMERA_MODES.ORBITCONTROL);
                const selector = document.getElementById('skill-selector');
                if (selector) selector.style.display = 'block';
            }
        }, 800);
    }
}
