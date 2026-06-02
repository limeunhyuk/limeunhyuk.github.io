/**
 * @file gameManager.js
 * @description
 * - 게임의 핵심 렌더링 루프 및 상태 변환(상태 기계)을 관리
 * - 매 프레임마다 물리 연산, 파티클 업데이트, 카메라 추적을 지시
 * - 턴 종료 조건(모든 돌의 정지 여부)을 판별
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

/**
 * @function animate
 * @description
 * - 브라우저의 requestAnimationFrame에 바인딩되는 메인 게임 루프
 * - 델타 타임(경과 시간)을 계산하여 애니메이션과 물리 시뮬레이션의 속도를 동기화
 * @param {number} time - 경과 시간 (밀리초)
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

/**
 * @function handleGameStateLogic
 * @description
 * - 현재 게임 상태(조준, 이동, 줌 등)에 맞게 로직을 분기하여 실행
 * - 이동(MOVING) 상태일 경우 슬로우 모션 제어, 충돌 감지, 턴 종료 검사 수행
 * @param {number} deltaTime - 프레임 간 경과 시간
 */
function handleGameStateLogic(deltaTime) {
    if (state.gameState === "MOVING" || state.gameState === "AIMING" || state.gameState === "GAMEOVER") {
        let targetSlowMo = 1.0;

        if (state.gameState === "MOVING") {
            const cameraResult = updateActionCamera(objects, state.lockedPair, state.firstCollisionOccurred);
            targetSlowMo = cameraResult.targetSlowMo;
            state.lockedPair = cameraResult.newLockedPair;
        }

        // 부드러운 슬로우 모션 전환을 위해 보간(Lerp) 적용
        state.currentSlowMoFactor += (targetSlowMo - state.currentSlowMoFactor) * 0.1;
        updateCameraLogic(deltaTime);

        // 물리 세계 업데이트 (슬로우 모션 팩터를 적용해 시간의 흐름 조절)
        objects.forEach(obj => { if (obj.active) obj.prevLinvel = { ...obj.body.linvel() }; });
        physicsWorld.timestep = (1.0 / 60.0) * Math.max(0.01, state.currentSlowMoFactor);
        physicsWorld.step(eventQueue);

        if (state.gameState === "MOVING") {
            handleCollisionEvents();
            checkMovementStopped();
        }
        
        // 물리 연산 결과 위치를 Three.js 렌더링 메쉬에 동기화
        updateMeshPositions(objects);
        checkFallOffBoard(showGameOver);

    } else if (state.gameState === "ZOOMING_IN" || state.gameState === "ZOOMING_OUT" || state.gameState === "MINIGAME" || state.gameState === "RETURN_TO_AIM") {
        // 미니게임이나 연출 상태에서는 물리 연산을 멈추고 카메라만 업데이트
        updateCameraLogic(deltaTime);
    }
}

/**
 * @function handleCollisionEvents
 * @description
 * - Rapier 물리 엔진의 충돌 큐를 비우고 발생한 이벤트를 분석
 * - 첫 번째 돌 간 충돌을 감지하여 스킬을 트리거 (예: 스나이퍼, 반사 등)
 * - 장벽(Wall) 스킬과의 충돌도 여기서 감지하여 처리
 */
function handleCollisionEvents() {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        if (started) {
            const obj1 = objects.find(o => o.body.handle === handle1);
            const obj2 = objects.find(o => o.body.handle === handle2);

            // 돌 vs 돌 충돌 처리
            if (obj1 && obj2 && obj1.type === 'stone' && obj2.type === 'stone') {
                if (!state.firstCollisionOccurred) {
                    state.firstCollisionOccurred = true;
                    const midPoint = new THREE.Vector3().addVectors(obj1.mesh.position, obj2.mesh.position).multiplyScalar(0.5);
                    skillManager.handleCollision(obj1, obj2, midPoint);
                }
            }

            // 돌 vs 장벽(Wall) 충돌 처리
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

/**
 * @function checkMovementStopped
 * @description
 * - 화면에 있는 모든 활성 돌들의 선속도를 검사
 * - 모든 돌의 속도가 임계점(0.1) 이하로 떨어지면 이동이 끝난 것으로 간주하여 턴 종료 처리
 * - 조준(AIMING) 상태로 전환하고 카메라를 초기 위치로 복귀
 */
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
