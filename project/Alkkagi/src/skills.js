/**
 * src/skills.js
 * Role: Special Skills Mechanism and Logic.
 * Functions:
 * - handleSkillInteraction(...): Processes skill-specific user inputs (e.g., Teleport).
 * - handleCollisionSkill(...): Dispatches skill effects upon stone collisions.
 * - executeSkillEffect(...): Logic for "Destroy" and "Repulse" skills.
 * - startMiniGame(...): Triggers the rhythm game cinematic and character swap.
 * - checkRhythmTiming(): Evaluates Spacebar timing for the mini-game.
 */
import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { scene, camera } from './engine.js';
import { state } from './state.js';
import { objects } from './stone.js';
import { assets } from './assets.js';
import { updateStatusUI, resetSkillUI, rhythmUi, rhythmText } from './ui.js';
import { createHitEffect } from './skillsVFX.js';

export function handleSkillInteraction(intersects, pointerDownPos, selectionRing) {
    if (state.currentSkill === "TELEPORT") {
        if (state.teleportSelectedStone) {
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                const clickedStone = objects.find(o => o.mesh === hitMesh);
                if (clickedStone && clickedStone.color === state.currentTurn) {
                    state.teleportSelectedStone = clickedStone;
                    selectionRing.position.set(state.teleportSelectedStone.mesh.position.x, 0.05, state.teleportSelectedStone.mesh.position.z);
                    selectionRing.visible = true;
                    return true;
                }
            }
            
            const tPos = pointerDownPos;
            state.teleportSelectedStone.body.setTranslation({ x: tPos.x, y: 0.125, z: tPos.z }, true);
            state.teleportSelectedStone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            state.teleportSelectedStone.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            state.teleportSelectedStone.mesh.position.set(tPos.x, 0.125, tPos.z);
            
            createHitEffect(new THREE.Vector3(tPos.x, 0.125, tPos.z));
            
            state.currentTurn = state.currentTurn === 'black' ? 'white' : 'black';
            updateStatusUI();
            
            state.currentSkill = "NONE";
            state.teleportSelectedStone = null;
            if (selectionRing) selectionRing.visible = false;
            resetSkillUI();
            return true;
        } else {
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                const clickedStone = objects.find(o => o.mesh === hitMesh);
                if (clickedStone && clickedStone.color === state.currentTurn) {
                    state.teleportSelectedStone = clickedStone;
                    selectionRing.position.set(state.teleportSelectedStone.mesh.position.x, 0.05, state.teleportSelectedStone.mesh.position.z);
                    selectionRing.visible = true;
                }
            }
            return true;
        }
    }
    return false;
}

export function handleCollisionSkill(obj1, obj2) {
    if (state.projectileSkill === "RHYTHM") {
        startMiniGame(obj1, obj2);
    } else if (state.projectileSkill === "DESTROY" || state.projectileSkill === "REPULSE") {
        const midPoint = new THREE.Vector3().addVectors(obj1.mesh.position, obj2.mesh.position).multiplyScalar(0.5);
        executeSkillEffect(obj1, obj2, midPoint, state.projectileSkill);
    }
}

export function executeSkillEffect(obj1, obj2, midPoint, skillType) {
    const v1 = obj1.prevLinvel || obj1.body.linvel();
    const v2 = obj2.prevLinvel || obj2.body.linvel();
    const speed1 = v1.x*v1.x + v1.z*v1.z;
    const speed2 = v2.x*v2.x + v2.z*v2.z;
    
    const attackerStone = speed1 > speed2 ? obj1 : obj2;
    const defenderStone = speed1 > speed2 ? obj2 : obj1;

    for (let i = 0; i < 3; i++) createHitEffect(midPoint); 

    if (skillType === "DESTROY") {
        defenderStone.body.setTranslation({ x: defenderStone.mesh.position.x, y: -10, z: defenderStone.mesh.position.z }, true);
    } else if (skillType === "REPULSE") {
        const radius = 5.0;
        const repulseForce = 35.0;
        
        objects.forEach(obj => {
            if (obj.active && obj.color !== attackerStone.color) {
                const dist = obj.mesh.position.distanceTo(midPoint);
                if (dist < radius) {
                    const dir = new THREE.Vector3().subVectors(obj.mesh.position, midPoint);
                    dir.y = 0;
                    if (dir.lengthSq() < 0.001) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
                    dir.normalize();
                    
                    const force = repulseForce * Math.pow(1.0 - (dist / radius), 1.5);
                    obj.body.applyImpulse({ x: dir.x * force, y: 0, z: dir.z * force }, true);
                }
            }
        });
    }
}

function createBlockCharacter(color) {
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
        // Dummy arm for animation if not found
        char.userData.rightArm = char.getObjectByName('RightArm') || { rotation: { x: 0 } };
        return char;
    }

    const group = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
    head.position.y = 0.9;
    head.castShadow = true;
    group.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), mat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);

    const armGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    armGeo.translate(0, -0.15, 0);
    
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(0.35, 0.6, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(-0.35, 0.6, 0);
    rightArm.castShadow = true;
    group.add(rightArm);
    group.userData.rightArm = rightArm;

    const legGeo = new THREE.BoxGeometry(0.18, 0.3, 0.18);
    legGeo.translate(0, -0.15, 0);
    
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(0.15, 0.2, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(-0.15, 0.2, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    group.scale.set(0.8, 0.8, 0.8);
    return group;
}

export function startMiniGame(stone1, stone2) {
    if (state.gameState !== "MOVING") return;
    state.gameState = "ZOOMING_IN";
    
    const midPoint = new THREE.Vector3().addVectors(stone1.mesh.position, stone2.mesh.position).multiplyScalar(0.5);
    createHitEffect(midPoint);
    
    const v1 = stone1.prevLinvel || stone1.body.linvel();
    const v2 = stone2.prevLinvel || stone2.body.linvel();
    const speed1 = v1.x*v1.x + v1.z*v1.z;
    const speed2 = v2.x*v2.x + v2.z*v2.z;
    
    const attackerStone = speed1 > speed2 ? stone1 : stone2;
    const defenderStone = speed1 > speed2 ? stone2 : stone1;

    stone1.mesh.visible = false;
    stone2.mesh.visible = false;

    const attacker = createBlockCharacter(attackerStone.color);
    attacker.position.set(attackerStone.mesh.position.x, 0.1, attackerStone.mesh.position.z);
    
    const defender = createBlockCharacter(defenderStone.color);
    defender.position.set(defenderStone.mesh.position.x, 0.1, defenderStone.mesh.position.z);

    attacker.lookAt(defender.position.x, attacker.position.y, defender.position.z);
    defender.lookAt(attacker.position.x, defender.position.y, attacker.position.z);

    scene.add(attacker);
    scene.add(defender);

    if (attacker.userData.rightArm) {
        new TWEEN.Tween(attacker.userData.rightArm.rotation)
            .to({ x: -Math.PI / 2 }, 150)
            .yoyo(true)
            .repeat(Infinity)
            .start();
    }
        
    new TWEEN.Tween(defender.rotation)
        .to({ x: defender.rotation.x - 0.2 }, 150)
        .yoyo(true)
        .repeat(Infinity)
        .start();

    window.currentFightScene = { attacker, defender, attackerStone, defenderStone };
    
    const dir = new THREE.Vector3().subVectors(attackerStone.mesh.position, defenderStone.mesh.position);
    if (dir.lengthSq() < 0.001) dir.set(1,0,0);
    dir.normalize();
    const sideVec = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    
    const targetCamPosVector = new THREE.Vector3().copy(midPoint).add(sideVec.multiplyScalar(7));
    targetCamPosVector.y = 2.5;

    new TWEEN.Tween(state.currentCamPos)
        .to({ x: targetCamPosVector.x, y: targetCamPosVector.y, z: targetCamPosVector.z }, 500)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    new TWEEN.Tween(state.currentCamLook)
        .to({ x: midPoint.x, y: midPoint.y, z: midPoint.z }, 500)
        .easing(TWEEN.Easing.Cubic.Out)
        .onComplete(() => {
            state.gameState = "MINIGAME";
            rhythmUi.style.display = 'block';
            state.rhythmActive = true;
            state.ringSize = 200 + Math.random() * 300;
            state.rhythmSpeed = 0.8 + Math.random() * 0.7;
            rhythmText.innerText = "타이밍에 맞춰 스페이스바!";
            rhythmText.style.color = "#fff";
        })
        .start();
}

export function checkRhythmTiming() {
    state.rhythmActive = false;
    
    const diff = Math.abs(state.ringSize - 100);
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
        
        new TWEEN.Tween(state.currentCamPos)
            .to({ x: 0, y: 40, z: 0 }, 1000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();

        new TWEEN.Tween(state.currentCamLook)
            .to({ x: 0, y: 0, z: 0 }, 1000)
            .onComplete(() => {
                if (state.gameState === "ZOOMING_OUT") {
                    state.gameState = "MOVING"; 
                    state.currentSlowMoFactor = 1.0;
                    
                    if (window.currentFightScene) {
                        scene.remove(window.currentFightScene.attacker);
                        scene.remove(window.currentFightScene.defender);
                        
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
            })
            .start();
            
    }, 1500);
}
