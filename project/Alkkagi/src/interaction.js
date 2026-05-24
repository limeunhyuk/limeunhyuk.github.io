/**
 * src/interaction.js
 * Role: General User Interaction and Input handling.
 * Functions:
 * - initInteraction(): Sets up pointer event listeners and visual drag aids.
 * - onPointerDown / Move / Up: Core logic for dragging and aiming stones.
 */
import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { camera, scene, physicsWorld } from './engine.js';
import { state } from './state.js';
import { objects } from './stone.js';
import { updateStatusUI, resetSkillUI } from './ui.js';
import { handleSkillInteraction } from './skills.js';

export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
export const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export let dragLine, trajectoryLine, selectionRing;

export function initInteraction() {
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const ringGeo = new THREE.RingGeometry(0.5, 0.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
    selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.visible = false;
    scene.add(selectionRing);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    dragLine = new THREE.Line(lineGeo, lineMat);
    dragLine.visible = false;
    scene.add(dragLine);

    const trajGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const trajMat = new THREE.LineDashedMaterial({ color: 0xffaa00, linewidth: 2, scale: 1, dashSize: 0.3, gapSize: 0.3 });
    trajectoryLine = new THREE.Line(trajGeo, trajMat);
    trajectoryLine.visible = false;
    scene.add(trajectoryLine);
}

function onPointerDown(e) {
    if (state.gameState !== "AIMING") return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects.filter(o => o.active).map(o => o.mesh));
    
    // Check for specialized skill interactions (e.g., Teleport)
    const pointerDownPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, pointerDownPos);
    if (handleSkillInteraction(intersects, pointerDownPos, selectionRing)) return;

    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const clickedStone = objects.find(o => o.mesh === hitMesh);
        
        if (clickedStone.color !== state.currentTurn) return;

        state.draggedStone = clickedStone;
        
        selectionRing.position.set(state.draggedStone.mesh.position.x, 0.05, state.draggedStone.mesh.position.z);
        selectionRing.visible = true;
        dragLine.visible = true;
        trajectoryLine.visible = true;
    }
}

function onPointerMove(e) {
    if (!state.draggedStone || state.gameState !== "AIMING" || state.currentSkill === "TELEPORT") return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    const startVec = new THREE.Vector3(state.draggedStone.mesh.position.x, 0.2, state.draggedStone.mesh.position.z);
    const dragVec = new THREE.Vector3().subVectors(startVec, intersectPoint);
    
    const maxDrag = 3.5;
    if (dragVec.length() > maxDrag) dragVec.setLength(maxDrag);
    
    const powerMultiplier = 0.75; 
    const power = dragVec.length() * powerMultiplier;
    
    const lineEnd = startVec.clone().sub(dragVec);
    dragLine.geometry.setFromPoints([startVec, lineEnd]);
    
    if (dragVec.length() > 0.1) {
        const dir = dragVec.clone().normalize();
        
        const rayStart = new THREE.Vector3(startVec.x + dir.x * 0.45, 0.125, startVec.z + dir.z * 0.45);
        const ray = new RAPIER.Ray(
            { x: rayStart.x, y: rayStart.y, z: rayStart.z }, 
            { x: dir.x, y: 0, z: dir.z }
        );
        const hit = physicsWorld.castRay(ray, 20.0, true);
        
        const distance = hit ? hit.timeOfImpact + 0.45 : 20.0;
        const endVec = startVec.clone().add(dir.multiplyScalar(distance));
        endVec.y = 0.2;

        const dashFactor = Math.max(0.2, Math.min(1.0, power * 0.05));
        trajectoryLine.material.dashSize = dashFactor;
        trajectoryLine.material.gapSize = dashFactor;
        
        trajectoryLine.geometry.dispose(); 
        trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
        trajectoryLine.computeLineDistances();
        trajectoryLine.visible = true;
    } else {
        trajectoryLine.visible = false;
    }
}

function onPointerUp(e) {
    if (!state.draggedStone || state.gameState !== "AIMING" || state.currentSkill === "TELEPORT") return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    const startVec = new THREE.Vector3(state.draggedStone.mesh.position.x, 0, state.draggedStone.mesh.position.z);
    const dragVec = new THREE.Vector3().subVectors(startVec, intersectPoint);
    
    const maxDrag = 3.5;
    if (dragVec.length() > maxDrag) dragVec.setLength(maxDrag);

    const powerMultiplier = 0.75; 
    const power = dragVec.length() * powerMultiplier;
    
    if (power > 0.5) {
        state.projectileSkill = state.currentSkill;

        dragVec.normalize().multiplyScalar(power);
        state.draggedStone.body.applyImpulse({ x: dragVec.x, y: 0, z: dragVec.z }, true);
        
        state.gameState = "MOVING";
        state.firstCollisionOccurred = false;
        state.currentSlowMoFactor = 1.0;
        
        state.currentTurn = state.currentTurn === 'black' ? 'white' : 'black';
        updateStatusUI();
        
        document.getElementById('skill-selector').style.display = 'none';
        state.currentSkill = "NONE";
        state.teleportSelectedStone = null;
        resetSkillUI();
    }
    
    selectionRing.visible = false;
    dragLine.visible = false;
    trajectoryLine.visible = false;
    state.draggedStone = null;
}
