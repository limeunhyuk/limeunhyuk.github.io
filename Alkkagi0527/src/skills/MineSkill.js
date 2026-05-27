/**
 * src/skills/MineSkill.js  [방해 스킬 1/5]
 * - 설치 즉시 턴 종료 (상대 턴에 지뢰가 활성화됨)
 * - 돌이 이미 있는 위치에는 설치 불가 (빨간 미리보기로 표시)
 * - 이동 중인 돌이 반경 진입 + 임계 속도 초과 → 폭발
 */
import * as THREE from 'three';
import { BaseSkill } from './BaseSkill.js';
import { objects }   from '../stone.js';
import { state }     from '../state.js';
import { scene }     from '../engine.js';
import { skillManager } from '../SkillManager.js';
import { createExplosionEffect } from '../skillsVFX.js';

const _placedMines = [];

export class MineSkill extends BaseSkill {
    constructor() {
        super("MINE", "🧨 지뢰 (Mine)", "DISRUPTION");
        this.previewMesh  = null;
        this.previewRing  = null;
        this._isBlocked   = false;
        this.MINE_RADIUS      = 1.5;
        this.EXPLOSION_FORCE  = 2.8;   // 5.5 → 2.8 (위력 감소)
        this.EXPLOSION_RADIUS = 2.4;   // 3.5 → 2.4 (폭발 반경 축소)
        this.TRIGGER_SPEED    = 0.25;
        this.BOARD_LIMIT      = 7.0;
        this.BLOCK_DIST       = 1.0;   // 0.75 → 1.0 (돌이 있는 영역 전체 차단)
    }

    onActivate() {
        const cyl = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x333333,
            emissive: 0xff2200,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.65
        });
        this.previewMesh = new THREE.Mesh(cyl, mat);
        this.previewMesh.visible = false;
        scene.add(this.previewMesh);

        const ringGeo = new THREE.RingGeometry(this.MINE_RADIUS - 0.07, this.MINE_RADIUS + 0.07, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff4400, side: THREE.DoubleSide,
            transparent: true, opacity: 0.55
        });
        this.previewRing = new THREE.Mesh(ringGeo, ringMat);
        this.previewRing.rotation.x = -Math.PI / 2;
        this.previewRing.visible = false;
        scene.add(this.previewRing);
    }

    /** 돌이 너무 가까운지 확인 */
    _checkBlocked(px, pz) {
        return objects.some(obj => {
            if (!obj.active) return false;
            const dx = obj.mesh.position.x - px;
            const dz = obj.mesh.position.z - pz;
            return Math.sqrt(dx * dx + dz * dz) < this.BLOCK_DIST;
        });
    }

    onPointerMove(intersects, pointerPos) {
        if (!this.previewMesh) return false;
        const px = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.x));
        const pz = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.z));

        this.previewMesh.position.set(px, 0.11, pz);
        this.previewRing.position.set(px, 0.02, pz);
        this.previewMesh.visible = true;
        this.previewRing.visible = true;

        // 돌이 있는 위치면 빨간색으로 경고
        this._isBlocked = this._checkBlocked(px, pz);
        this.previewMesh.material.color.setHex(this._isBlocked ? 0xff2200 : 0x333333);
        this.previewMesh.material.emissive.setHex(this._isBlocked ? 0xff0000 : 0xff2200);
        this.previewRing.material.color.setHex(this._isBlocked ? 0xff0000 : 0xff4400);

        return false;
    }

    onPointerDown(intersects, pointerPos) {
        if (!this.previewMesh?.visible) return false;
        if (this._isBlocked) return true; // 차단 — 설치 거부

        const px = this.previewMesh.position.x;
        const pz = this.previewMesh.position.z;

        // ── 배치된 지뢰 비주얼 ──
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16),
            new THREE.MeshPhongMaterial({ color: 0x222222, emissive: 0xff2200, emissiveIntensity: 0.3 })
        );
        mesh.position.set(px, 0.11, pz);
        scene.add(mesh);

        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.07, 0.18, 6),
            new THREE.MeshPhongMaterial({ color: 0x555555 })
        );
        spike.position.set(px, 0.29, pz);
        scene.add(spike);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(this.MINE_RADIUS - 0.07, this.MINE_RADIUS + 0.07, 48),
            new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide, transparent: true, opacity: 0.2 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(px, 0.02, pz);
        scene.add(ring);

        _placedMines.push({
            mesh, spike, ring,
            position:       new THREE.Vector3(px, 0, pz),
            radius:         this.MINE_RADIUS,
            explosionForce: this.EXPLOSION_FORCE,
            explosionRadius:this.EXPLOSION_RADIUS,
            active: true
        });

        skillManager.markSkillUsed(state.currentTurn, this.id);

        // 미리보기 숨기기
        this.previewMesh.visible = false;
        this.previewRing.visible = false;

        // ── 설치 즉시 턴 종료 ──
        this._endTurn();
        return true;
    }

    _endTurn() {
        state.disruptionUsedLastTurn = true; // 상대 다음 턴 방해 스킬 차단
        state.draggedStone = null;
        skillManager.setSkill("NONE");
        state.currentTurn = state.currentTurn === 'black' ? 'white' : 'black';
        import('../ui.js').then(m => {
            m.updateStatusUI();
            m.resetSkillUI();
            m.updateSkillAvailabilityUI();
        });
    }

    updateVFX(deltaTime) {
        if (_placedMines.length === 0) return;
        if (state.gameState !== "MOVING") return;

        for (let i = _placedMines.length - 1; i >= 0; i--) {
            const mine = _placedMines[i];
            if (!mine.active) continue;

            for (const obj of objects) {
                if (!obj.active) continue;
                const dist = obj.mesh.position.distanceTo(mine.position);
                if (dist > mine.radius) continue;

                const vel = obj.body.linvel();
                if (Math.sqrt(vel.x * vel.x + vel.z * vel.z) < this.TRIGGER_SPEED) continue;

                mine.active = false;
                scene.remove(mine.mesh);
                scene.remove(mine.spike);
                scene.remove(mine.ring);
                _placedMines.splice(i, 1);

                createExplosionEffect(mine.position.clone().setY(0.2));

                const mPos = mine.position;
                objects.forEach(target => {
                    if (!target.active) return;
                    const d = target.mesh.position.distanceTo(mPos);
                    if (d < mine.explosionRadius) {
                        const dir = new THREE.Vector3().subVectors(target.mesh.position, mPos);
                        dir.y = 0;
                        if (dir.lengthSq() < 0.001)
                            dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
                        dir.normalize();
                        const force = mine.explosionForce * (1 - d / mine.explosionRadius);
                        target.body.applyImpulse({ x: dir.x * force, y: 0, z: dir.z * force }, true);
                    }
                });
                break;
            }
        }
    }

    dispose() {
        if (this.previewMesh) {
            scene.remove(this.previewMesh);
            this.previewMesh.geometry.dispose();
            this.previewMesh.material.dispose();
            this.previewMesh = null;
        }
        if (this.previewRing) {
            scene.remove(this.previewRing);
            this.previewRing.geometry.dispose();
            this.previewRing.material.dispose();
            this.previewRing = null;
        }
    }

    clearAll() {
        _placedMines.forEach(m => {
            if (m.mesh)  scene.remove(m.mesh);
            if (m.spike) scene.remove(m.spike);
            if (m.ring)  scene.remove(m.ring);
        });
        _placedMines.length = 0;
    }
}
