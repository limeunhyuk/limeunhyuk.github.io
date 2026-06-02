/**
 * src/gameManager.js
 * Role: Game loop & State transition orchestrator.
 */
import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { renderer, scene, physicsWorld, eventQueue, updateMeshPositions } from './engine.js';
import { state } from './state.js';
import { objects, checkFallOffBoard } from './stone.js';
import { skillManager } from './SkillManager.js';
import { updateParticles } from './skillsVFX.js';
import { updateWeather } from './weather.js';
import { showGameOver, toggleGameUI } from './ui.js';
import { updateCamera as updateCameraLogic, setCameraMode, CAMERA_MODES, getCamera, updateActionCamera } from './cameraManager.js';
import { WallSkill } from './skills/WallSkill.js';

let lastTime = 0;

/** Game's main loop
 *  Runs every frame.
 */
export function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    TWEEN.update(time);
    state.frameCount++;

    handleGameStateLogic(deltaTime);
    skillManager.updateVFX(deltaTime); 
    updateParticles();
    updateWeather(deltaTime);
    
    renderer.render(scene, getCamera());
}

/** 턴의 진행 상태(조준/이동/연출)에 따른 물리 및 카메라 업데이트 제어 */
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

        // 물리 세계 업데이트 (슬로우 모션 팩터 반영)
        objects.forEach(obj => { if (obj.active) obj.prevLinvel = { ...obj.body.linvel() }; });
        physicsWorld.timestep = (1.0 / 60.0) * Math.max(0.01, state.currentSlowMoFactor);
        physicsWorld.step(eventQueue);

        if (state.gameState === "MOVING") {
            handleCollisionEvents();
            checkMovementStopped();
        }
        
        updateMeshPositions(objects);   // sync Three.js mesh transform with physics body
        checkFallOffBoard(showGameOver);

    } else if (state.gameState === "ZOOMING_IN" || state.gameState === "ZOOMING_OUT" || state.gameState === "MINIGAME" || state.gameState === "RETURN_TO_AIM") {
        updateCameraLogic(deltaTime);
    }
}

/** 물리 충돌 큐를 비우고, 첫 번째 유효 충돌 시 스킬 트리거 */
function handleCollisionEvents() {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        if (started) {
            const obj1 = objects.find(o => o.body.handle === handle1);
            const obj2 = objects.find(o => o.body.handle === handle2);

            // Case 1: Stone vs Stone
            if (obj1 && obj2 && obj1.type === 'stone' && obj2.type === 'stone') {
                if (!state.firstCollisionOccurred) {
                    state.firstCollisionOccurred = true;
                    const midPoint = new THREE.Vector3().addVectors(obj1.mesh.position, obj2.mesh.position).multiplyScalar(0.5);
                    skillManager.handleCollision(obj1, obj2, midPoint);
                }
            }

            // Case 2: Stone vs Wall
            const wall = WallSkill.activeInstance;
            if (wall && wall.placedWall) {
                const wallHandle = wall.placedWall.body.handle;
                if (handle1 === wallHandle || handle2 === wallHandle) {
                    const stoneObj = obj1 || obj2;
                    if (stoneObj && stoneObj.type === 'stone') {
                        wall.onWallHit(stoneObj.mesh.position);
                    }
                }
            }
        }
    });
}

/** 모든 돌의 속도가 임계치 이하인지 확인하여 턴 종료 처리 */
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

        skillManager.resetTurn();
        setCameraMode(CAMERA_MODES.DEFAULT);
        
        setTimeout(() => {
            if (state.gameState === "RETURN_TO_AIM") {
                state.gameState = "AIMING";
                setCameraMode(CAMERA_MODES.DEFAULT);
                toggleGameUI(true);
            }
        }, 800);
    }
}
