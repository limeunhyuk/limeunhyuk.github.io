import { BaseSkill } from './BaseSkill.js';
import { state } from '../state.js';
import { updateStatusUI, resetSkillUI } from '../ui.js';
import { objects } from '../stone.js';
import { createHitEffect } from '../skillsVFX.js';
import * as THREE from 'three';

/**
 * TeleportSkill
 * Role: Allows a player to move their own stone to any position on the board.
 */
export class TeleportSkill extends BaseSkill {
    constructor() {
        super("TELEPORT", "순간이동 (Teleport)");
    }

    onInteract(intersects, pointerPos, selectionRing) {
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
            
            const tPos = pointerPos;
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
}
