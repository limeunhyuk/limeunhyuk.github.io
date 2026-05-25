import { BaseSkill } from './BaseSkill.js';
import { state } from '../state.js';
import { scene } from '../engine.js';
import { assets } from '../assets.js';
import { rhythmUi, rhythmText, shrinkingRing } from '../ui.js';
import { createHitEffect } from '../skillsVFX.js';
import { setCameraMode, setCameraTarget, CAMERA_MODES } from '../cameraManager.js';
import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';

/**
 * RhythmSkill
 * Role: Triggers a cinematic rhythm-based mini-game on impact.
 */
export class RhythmSkill extends BaseSkill {
    constructor() {
        super("RHYTHM", "리듬 배틀 (Rhythm)");
        this.isActive = false;
        this.ringSize = 250;
        this.rhythmSpeed = 1.0;
        this.handleKeyDownBound = this.handleKeyDown.bind(this);
    }

    onCollision(attacker, defender, midPoint) {
        if (state.gameState !== "MOVING") return;
        state.gameState = "ZOOMING_IN";
        
        createHitEffect(midPoint);
        
        const v1 = attacker.prevLinvel || attacker.body.linvel();
        const v2 = defender.prevLinvel || defender.body.linvel();
        const speed1 = v1.x*v1.x + v1.z*v1.z;
        const speed2 = v2.x*v2.x + v2.z*v2.z;
        
        const attackerStone = speed1 > speed2 ? attacker : defender;
        const defenderStone = speed1 > speed2 ? defender : attacker;

        attackerStone.mesh.visible = false;
        defenderStone.mesh.visible = false;

        const attackerChar = this.createCharacter(attackerStone.color);
        attackerChar.position.set(attackerStone.mesh.position.x, 0.1, attackerStone.mesh.position.z);
        
        const defenderChar = this.createCharacter(defenderStone.color);
        defenderChar.position.set(defenderStone.mesh.position.x, 0.1, defenderStone.mesh.position.z);

        attackerChar.lookAt(defenderChar.position.x, attackerChar.position.y, defenderChar.position.z);
        defenderChar.lookAt(attackerChar.position.x, defenderChar.position.y, attackerChar.position.z);

        scene.add(attackerChar);
        scene.add(defenderChar);

        if (attackerChar.userData.rightArm) {
            new TWEEN.Tween(attackerChar.userData.rightArm.rotation)
                .to({ x: -Math.PI / 2 }, 150)
                .yoyo(true)
                .repeat(Infinity)
                .start();
        }
        
        new TWEEN.Tween(defenderChar.rotation)
            .to({ x: defenderChar.rotation.x - 0.2 }, 150)
            .yoyo(true)
            .repeat(Infinity)
            .start();

        window.currentFightScene = { attackerChar, defenderChar, attackerStone, defenderStone };
        
        const dir = new THREE.Vector3().subVectors(attackerStone.mesh.position, defenderStone.mesh.position);
        if (dir.lengthSq() < 0.001) dir.set(1,0,0);
        dir.normalize();
        const sideVec = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        
        const targetCamPosVector = new THREE.Vector3().copy(midPoint).add(sideVec.multiplyScalar(7));
        targetCamPosVector.y = 2.5;

        // Camera Manager의 FOLLOW 모드를 사용하여 타겟 지점으로 이동
        setCameraMode(CAMERA_MODES.FOLLOW);
        setCameraTarget(targetCamPosVector, midPoint);

        // 일정 시간 후 미니게임 모드 진입
        setTimeout(() => {
            state.gameState = "MINIGAME";
            rhythmUi.style.display = 'block';
            
            // Initialize minigame state
            this.isActive = true;
            this.ringSize = 200 + Math.random() * 300;
            this.rhythmSpeed = 0.8 + Math.random() * 0.7;
            
            rhythmText.innerText = "타이밍에 맞춰 스페이스바!";
            rhythmText.style.color = "#fff";
            
            // Attach input listener
            window.addEventListener('keydown', this.handleKeyDownBound);
        }, 500);
    }

    handleKeyDown(e) {
        if (e.code === 'Space' && this.isActive) {
            this.checkRhythmTiming();
        }
    }

    updateVFX(deltaTime) {
        if (!this.isActive) return;

        this.ringSize -= this.rhythmSpeed;
        if (this.ringSize < 40) { 
            this.checkRhythmTiming();
        } else if (shrinkingRing) {
            shrinkingRing.style.width = this.ringSize + 'px';
            shrinkingRing.style.height = this.ringSize + 'px';
        }
    }

    checkRhythmTiming() {
        this.isActive = false;
        window.removeEventListener('keydown', this.handleKeyDownBound);
        
        const diff = Math.abs(this.ringSize - 100);
        let rhythmResult = 'miss';
        
        if (diff <= 15) {
            rhythmResult = 'perfect';
            rhythmText.innerText = "PERFECT!";
            rhythmText.style.color = "#00ff00";
        } else if (diff <= 35) {
            rhythmResult = 'good';
            rhythmText.innerText = "GOOD!";
            rhythmText.style.color = "#ffff00";
        } else {
            rhythmResult = 'miss';
            rhythmText.innerText = "MISS... (페널티!)";
            rhythmText.style.color = "#ff0000";
        }

        if (window.currentFightScene) {
            window.currentFightScene.rhythmResult = rhythmResult;
        }

        setTimeout(() => {
            if (rhythmUi) rhythmUi.style.display = 'none';
            state.gameState = "ZOOMING_OUT"; 
            
            // Camera Manager를 기본 모드로 돌려 부드럽게 복귀 유도
            setCameraMode(CAMERA_MODES.DEFAULT);

            // 복귀 연출 시간 대기 후 게임 재개
            setTimeout(() => {
                if (state.gameState === "ZOOMING_OUT") {
                    state.gameState = "MOVING"; 
                    state.currentSlowMoFactor = 1.0;
                    
                    if (window.currentFightScene) {
                        scene.remove(window.currentFightScene.attackerChar);
                        scene.remove(window.currentFightScene.defenderChar);
                        
                        const { attackerStone, defenderStone, rhythmResult } = window.currentFightScene;
                        attackerStone.mesh.visible = true;
                        defenderStone.mesh.visible = true;
                        
                        const dir = new THREE.Vector3().subVectors(defenderStone.mesh.position, attackerStone.mesh.position);
                        dir.y = 0;
                        if (dir.lengthSq() < 0.001) dir.set(1, 0, 0);
                        dir.normalize();

                        if (rhythmResult === 'perfect') {
                            attackerStone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                            const v = defenderStone.body.linvel();
                            const speed = Math.sqrt(v.x*v.x + v.z*v.z);
                            if (speed < 15.0) {
                                defenderStone.body.setLinvel({ x: dir.x * 15.0, y: 0, z: dir.z * 15.0 }, true);
                            }
                        } else if (rhythmResult === 'miss') {
                            defenderStone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                            const v = attackerStone.body.linvel();
                            const speed = Math.sqrt(v.x*v.x + v.z*v.z);
                            const reboundSpeed = Math.max(15.0, speed);
                            attackerStone.body.setLinvel({ x: -dir.x * reboundSpeed, y: 0, z: -dir.z * reboundSpeed }, true);
                        }

                        window.currentFightScene = null;
                    }
                }
            }, 1000);
                
        }, 1500);
    }

    dispose() {
        this.isActive = false;
        window.removeEventListener('keydown', this.handleKeyDownBound);
    }

    createCharacter(color) {
        const colorHex = color === 'black' ? 0x111111 : 0xeeeeee;
        const mat = new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.3, clearcoat: 0.5 });

        if (assets.models.character) {
            const char = assets.models.character.clone();
            char.scale.set(0.8, 0.8, 0.8);
            char.traverse(node => {
                if (node.isMesh) {
                    node.material = mat;
                    node.castShadow = true;
                }
            });
            char.userData.rightArm = char.getObjectByName('RightArm') || { rotation: { x: 0 } };
            return char;
        }
        else {
            console.log("assets/models/character.glb not found");
        }
    }
}
