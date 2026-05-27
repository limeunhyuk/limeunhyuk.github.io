/**
 * src/skills/BlackHoleSkill.js  [방해 스킬 4/5]
 * - 설치 즉시 턴 종료
 * - 다음 MOVING 페이즈에서 범위 내 돌을 끌어당김
 * - MAX_ACTIVE_TIME(3s) 경과 후 인력 중단 → 게임이 멈추지 않음
 * - 1번 resetTurn 후 사라짐 (상대 1턴 동안 유지)
 */
import * as THREE from 'three';
import { BaseSkill } from './BaseSkill.js';
import { objects }   from '../stone.js';
import { state }     from '../state.js';
import { scene }     from '../engine.js';
import { skillManager } from '../SkillManager.js';

// ── Module-level persistent storage ──────────────────────────────
const _blackHoles = [];

/** MOVING 상태 누적 시간이 이 값을 초과하면 인력 중단 */
const MAX_ACTIVE_TIME = 3.0;

export class BlackHoleSkill extends BaseSkill {
    constructor() {
        super("BLACKHOLE", "🌀 블랙홀 (Blackhole)", "DISRUPTION");
        this.previewMesh  = null;
        this.previewRing  = null;
        this.PULL_RADIUS  = 3.5;   // 5.0 → 3.5 (범위 축소)
        this.PULL_FORCE   = 0.025; // 0.10 → 0.025 (인력 대폭 감소)
        this.BOARD_LIMIT  = 7.0;
        this._animTime    = 0;
    }

    onActivate() {
        // 미리보기 구체
        this.previewMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 8),
            new THREE.MeshBasicMaterial({ color: 0x110022, transparent: true, opacity: 0.8 })
        );
        this.previewMesh.visible = false;
        scene.add(this.previewMesh);

        // 당김 반경 미리보기 링
        this.previewRing = new THREE.Mesh(
            new THREE.RingGeometry(this.PULL_RADIUS - 0.07, this.PULL_RADIUS + 0.07, 56),
            new THREE.MeshBasicMaterial({
                color: 0x9900ff, side: THREE.DoubleSide,
                transparent: true, opacity: 0.45
            })
        );
        this.previewRing.rotation.x = -Math.PI / 2;
        this.previewRing.visible = false;
        scene.add(this.previewRing);
    }

    onPointerMove(intersects, pointerPos) {
        if (!this.previewMesh) return false;
        const px = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.x));
        const pz = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.z));
        this.previewMesh.position.set(px, 0.5, pz);
        this.previewMesh.visible = true;
        this.previewRing.position.set(px, 0.02, pz);
        this.previewRing.visible = true;
        return false;
    }

    onPointerDown(intersects, pointerPos) {
        if (!this.previewMesh?.visible) return false;

        const px = this.previewMesh.position.x;
        const pz = this.previewMesh.position.z;

        // ── 블랙홀 핵심 구체 ──
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 20, 10),
            new THREE.MeshBasicMaterial({ color: 0x050010 })
        );
        sphere.position.set(px, 0.5, pz);
        scene.add(sphere);

        // 강착 원반 (회전하는 링)
        const disk = new THREE.Mesh(
            new THREE.TorusGeometry(1.0, 0.18, 8, 40),
            new THREE.MeshBasicMaterial({ color: 0x9900ff, transparent: true, opacity: 0.75 })
        );
        disk.position.set(px, 0.5, pz);
        scene.add(disk);

        // 외부 당김 반경 표시 링
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(this.PULL_RADIUS - 0.07, this.PULL_RADIUS + 0.07, 56),
            new THREE.MeshBasicMaterial({
                color: 0x6600cc, side: THREE.DoubleSide,
                transparent: true, opacity: 0.25
            })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(px, 0.02, pz);
        scene.add(ring);

        // 블랙홀 중심 포인트 조명 (약한 보라)
        const light = new THREE.PointLight(0x6600bb, 0.9, this.PULL_RADIUS * 1.5);
        light.position.set(px, 0.6, pz);
        scene.add(light);

        _blackHoles.push({
            sphere, disk, ring, light,
            position:    new THREE.Vector3(px, 0, pz),
            movingTime:  0,    // MOVING 상태에서 누적된 시간
            turnsLeft:   1,    // 상대 1턴 후 사라짐
        });

        skillManager.markSkillUsed(state.currentTurn, this.id);
        this.previewMesh.visible  = false;
        this.previewRing.visible  = false;

        this._endTurn();
        return true;
    }

    updateVFX(deltaTime) {
        const dt = deltaTime || 0.016;
        this._animTime += dt;

        // 강착 원반 회전 애니메이션 (항상 돌아감)
        _blackHoles.forEach(bh => {
            bh.disk.rotation.y = this._animTime * 2.2;
            bh.disk.rotation.x = Math.sin(this._animTime * 0.8) * 0.4;
            if (bh.light) {
                bh.light.intensity = 0.7 + 0.3 * Math.sin(this._animTime * 3.1);
            }
        });

        if (state.gameState !== "MOVING") return;

        // 인력 적용 (MAX_ACTIVE_TIME 이내에만)
        for (const bh of _blackHoles) {
            bh.movingTime += dt;
            if (bh.movingTime >= MAX_ACTIVE_TIME) continue; // 시간 초과 → 인력 중단

            const bhPos = bh.position;
            objects.forEach(obj => {
                if (!obj.active) return;
                const dist = obj.mesh.position.distanceTo(bhPos);
                if (dist < this.PULL_RADIUS && dist > 0.35) {
                    const dir = new THREE.Vector3()
                        .subVectors(bhPos, obj.mesh.position);
                    dir.y = 0;
                    dir.normalize();

                    // 선형 감소: 가까울수록 강하게, 하지만 폭주하지 않음
                    const falloff = 1.0 - (dist / this.PULL_RADIUS);
                    const force   = this.PULL_FORCE * falloff;
                    obj.body.applyImpulse({ x: dir.x * force, y: 0, z: dir.z * force }, true);
                }
            });
        }
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

    dispose() {
        // 1턴 경과 → 블랙홀 제거
        for (let i = _blackHoles.length - 1; i >= 0; i--) {
            _blackHoles[i].turnsLeft--;
            if (_blackHoles[i].turnsLeft <= 0) {
                const bh = _blackHoles[i];
                scene.remove(bh.sphere);
                scene.remove(bh.disk);
                scene.remove(bh.ring);
                scene.remove(bh.light);
                _blackHoles.splice(i, 1);
            }
        }
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
        _blackHoles.forEach(bh => {
            scene.remove(bh.sphere);
            scene.remove(bh.disk);
            scene.remove(bh.ring);
            scene.remove(bh.light);
        });
        _blackHoles.length = 0;
    }
}
