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
        super("WALL", "🛡️ 철벽 방어 (Wall)");
        this.previewMesh = null;
        this.placedWall = null; // { mesh, body }
        this.boardSize = 15;
        this.wallHeight = 2.0;
        this.wallThickness = 0.5;
        this.currentHoverSide = null;
    }

    onActivate() {
        // 흑: 청회색 와이어프레임 / 백: 흰색 와이어프레임
        const previewColor = state.currentTurn === 'black' ? 0x444444 : 0xffffff;
        const geo = new THREE.BoxGeometry(this.boardSize, this.wallHeight, this.wallThickness);
        const mat = new THREE.MeshBasicMaterial({
            color: previewColor,
            transparent: true,
            opacity: 0.45,
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

        // 1. Visual Mesh — 흑: 강철 청회색(발광) / 백: 광택 흰 벽
        const isBlack = state.currentTurn === 'black';
        const wallColor    = isBlack ? 0x0a0a0a : 0xeeeeee;  // 흑: 검은색
        const emissiveCol  = isBlack ? 0x222222 : 0xffffff;  // 흑: 어두운 발광
        const emissiveInt  = isBlack ? 0.4      : 0.45;      // 흑: 은은한 발광

        const geo = new THREE.BoxGeometry(this.boardSize, this.wallHeight, this.wallThickness);
        const mat = new THREE.MeshPhongMaterial({
            color:              wallColor,
            transparent:        true,
            opacity:            0.82,
            emissive:           emissiveCol,
            emissiveIntensity:  emissiveInt,
            shininess:          isBlack ? 80 : 90
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.rotation.copy(rot);
        scene.add(mesh);

        // 1b. 엣지 라인 — 흑팀 벽 윤곽선으로 가시성 향상
        let edgesMesh = null;
        if (isBlack) {
            const edgesGeo = new THREE.EdgesGeometry(geo);
            const edgesMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 2 });
            edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
            edgesMesh.position.copy(pos);
            edgesMesh.rotation.copy(rot);
            scene.add(edgesMesh);
        }

        // 2. Physics Body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
        if (this.currentHoverSide === 'EAST' || this.currentHoverSide === 'WEST') {
            bodyDesc.setRotation({ w: Math.cos(Math.PI/4), x: 0, y: Math.sin(Math.PI/4), z: 0 });
        }
        const body = physicsWorld.createRigidBody(bodyDesc);

        // 아군 돌만 막고 적 돌은 통과
        // 흑이 설치 → filter=0x0001(흑돌만 충돌), 백이 설치 → filter=0x0002(백돌만 충돌)
        const friendGroup = state.currentTurn === 'black' ? 0x0001 : 0x0002;
        const wallCollisionGroups = (0x0010 << 16) | friendGroup;

        const colliderDesc = RAPIER.ColliderDesc.cuboid(this.boardSize/2, this.wallHeight/2, this.wallThickness/2)
            .setCollisionGroups(wallCollisionGroups);
        physicsWorld.createCollider(colliderDesc, body);

        this.placedWall = { mesh, body, edges: edgesMesh };
        this.previewMesh.visible = false;

        // 사용 마킹 (벽 설치 = 스킬 소모)
        skillManager.markSkillUsed(state.currentTurn, this.id);

        // Return to normal aiming state
        skillManager.setSkill("NONE");
        import('../ui.js').then(m => { m.resetSkillUI(); m.updateSkillAvailabilityUI(); });
    }

    destroyWall() {
        if (!this.placedWall) return;
        scene.remove(this.placedWall.mesh);
        if (this.placedWall.edges) {
            scene.remove(this.placedWall.edges);
            this.placedWall.edges.geometry.dispose();
            this.placedWall.edges.material.dispose();
        }
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
