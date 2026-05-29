import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { BaseSkill } from './BaseSkill.js';
import { scene, physicsWorld } from '../engine.js';
import { state } from '../state.js';
import { skillManager } from '../SkillManager.js';

/**
 * WallSkill
 * Role: Allows placing a temporary protective wall on one side of the board.
 */
export class WallSkill extends BaseSkill {
    constructor() {
        super("WALL", "철벽 방어 (Wall)");
        this.previewMesh = null;
        this.placedWall = null; // { mesh, body }
        this.boardSize = 15;
        this.wallHeight = 2.0;
        this.wallThickness = 0.5;
        this.currentHoverSide = null;
    }

    onActivate() {
        // Create preview mesh
        const geo = new THREE.BoxGeometry(this.boardSize, this.wallHeight, this.wallThickness);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });
        this.previewMesh = new THREE.Mesh(geo, mat);
        this.previewMesh.visible = false;
        scene.add(this.previewMesh);
    }

    onDeactivate() {
        this.cleanupPreview();
        // Note: The placed wall stays until turn ends (handled in dispose/gameManager)
    }

    onPointerMove(intersects, pointerPos) {
        if (!this.previewMesh) return false;

        // Calculate closest side
        const x = pointerPos.x;
        const z = pointerPos.z;

        if (Math.abs(x) > this.boardSize / 2 + 2 || Math.abs(z) > this.boardSize / 2 + 2) {
            this.previewMesh.visible = false;
            this.currentHoverSide = null;
            return false;
        }

        this.previewMesh.visible = true;
        if (Math.abs(x) > Math.abs(z)) {
            // East or West
            this.currentHoverSide = x > 0 ? 'EAST' : 'WEST';
            this.previewMesh.position.set(x > 0 ? this.boardSize/2 : -this.boardSize/2, this.wallHeight/2, 0);
            this.previewMesh.scale.set(1, 1, 1);
            this.previewMesh.rotation.set(0, Math.PI / 2, 0);
        } else {
            // North or South
            this.currentHoverSide = z > 0 ? 'SOUTH' : 'NORTH';
            this.previewMesh.position.set(0, this.wallHeight/2, z > 0 ? this.boardSize/2 : -this.boardSize/2);
            this.previewMesh.scale.set(1, 1, 1);
            this.previewMesh.rotation.set(0, 0, 0);
        }

        return true; // Block default aiming
    }

    onPointerDown(intersects, pointerPos) {
        if (this.currentHoverSide) {
            this.placeWall();
            return true; // Block default stone selection
        }
        return false;
    }

    placeWall() {
        if (this.placedWall) this.destroyWall();

        const pos = this.previewMesh.position.clone();
        const rot = this.previewMesh.rotation.clone();

        // 1. Visual Mesh
        const geo = new THREE.BoxGeometry(this.boardSize, this.wallHeight, this.wallThickness);
        const mat = new THREE.MeshPhongMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.6,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.rotation.copy(rot);
        scene.add(mesh);

        // 2. Physics Body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
        if (this.currentHoverSide === 'EAST' || this.currentHoverSide === 'WEST') {
            bodyDesc.setRotation({ w: Math.cos(Math.PI/4), x: 0, y: Math.sin(Math.PI/4), z: 0 });
        }
        const body = physicsWorld.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(this.boardSize/2, this.wallHeight/2, this.wallThickness/2);
        physicsWorld.createCollider(colliderDesc, body);

        this.placedWall = { mesh, body };
        this.previewMesh.visible = false;
        
        // Return to normal aiming state
        skillManager.setSkill("NONE");
        import('../ui.js').then(m => m.resetSkillUI());
    }

    destroyWall() {
        if (!this.placedWall) return;
        scene.remove(this.placedWall.mesh);
        physicsWorld.removeRigidBody(this.placedWall.body);
        this.placedWall = null;
    }

    cleanupPreview() {
        if (this.previewMesh) {
            scene.remove(this.previewMesh);
            this.previewMesh.geometry.dispose();
            this.previewMesh.material.dispose();
            this.previewMesh = null;
        }
    }

    dispose() {
        this.cleanupPreview();
        this.destroyWall();
    }
}
