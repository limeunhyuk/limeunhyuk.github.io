/**
 * src/skills/IceSkill.js  [방해 스킬 3/5]
 * - 설치 즉시 턴 종료
 * - 빙판 구역 내 돌의 선형 감쇠를 대폭 낮춤 (미끄러운 물리)
 * - 2번 resetTurn 후 사라짐 (상대 1턴 + 자기 1턴 동안 유지)
 * - 시각: MeshPhysicalMaterial 광택 + 균열선 + 서리 테두리 + 얼음 조명
 */
import * as THREE from 'three';
import { BaseSkill } from './BaseSkill.js';
import { objects }   from '../stone.js';
import { state }     from '../state.js';
import { scene }     from '../engine.js';
import { skillManager } from '../SkillManager.js';

// ── Module-level persistent storage ──────────────────────────────
const _iceZones = [];

const NORMAL_DAMPING = 2.0;
const ICE_DAMPING    = 0.08;   // 낮을수록 미끄럽다

export class IceSkill extends BaseSkill {
    constructor() {
        super("ICE", "🧊 얼음 바닥 (Ice)", "DISRUPTION");
        this.previewMesh  = null;
        this.ICE_RADIUS   = 2.5;
        this.BOARD_LIMIT  = 7.0;
        this.TURNS_DURATION = 1;  // 상대 1턴만 유지
        this._time = 0;
    }

    onActivate() {
        const geo = new THREE.CylinderGeometry(this.ICE_RADIUS, this.ICE_RADIUS, 0.08, 48);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.55,
            roughness: 0.0,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
        });
        this.previewMesh = new THREE.Mesh(geo, mat);
        this.previewMesh.visible = false;
        scene.add(this.previewMesh);
    }

    onPointerMove(intersects, pointerPos) {
        if (!this.previewMesh) return false;
        const px = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.x));
        const pz = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.z));
        this.previewMesh.position.set(px, 0.01, pz);
        this.previewMesh.visible = true;
        return false;
    }

    onPointerDown(intersects, pointerPos) {
        if (!this.previewMesh?.visible) return false;

        const px = this.previewMesh.position.x;
        const pz = this.previewMesh.position.z;

        // ── 메인 빙판 (고광택 유리 얼음 느낌) ──
        const iceMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(this.ICE_RADIUS, this.ICE_RADIUS, 0.08, 48),
            new THREE.MeshPhysicalMaterial({
                color: 0xc8eeff,
                transparent: true,
                opacity: 0.75,
                roughness: 0.0,
                metalness: 0.0,
                clearcoat: 1.0,
                clearcoatRoughness: 0.02,
                reflectivity: 1.0,
            })
        );
        iceMesh.position.set(px, 0.01, pz);
        scene.add(iceMesh);

        // ── 얼음 균열선 (중심에서 방사형) ──
        const crackLines = this._buildCracks(px, pz);
        crackLines.forEach(l => scene.add(l));

        // ── 외곽 서리 테두리 링 (두꺼운 흰색) ──
        const rim1 = new THREE.Mesh(
            new THREE.RingGeometry(this.ICE_RADIUS - 0.18, this.ICE_RADIUS + 0.08, 48),
            new THREE.MeshBasicMaterial({
                color: 0xffffff, side: THREE.DoubleSide,
                transparent: true, opacity: 0.60
            })
        );
        rim1.rotation.x = -Math.PI / 2;
        rim1.position.set(px, 0.03, pz);
        scene.add(rim1);

        // ── 내부 중간 링 (연한 하늘색 원) ──
        const rim2 = new THREE.Mesh(
            new THREE.RingGeometry(this.ICE_RADIUS * 0.50, this.ICE_RADIUS * 0.62, 48),
            new THREE.MeshBasicMaterial({
                color: 0xddf6ff, side: THREE.DoubleSide,
                transparent: true, opacity: 0.38
            })
        );
        rim2.rotation.x = -Math.PI / 2;
        rim2.position.set(px, 0.03, pz);
        scene.add(rim2);

        // ── 반사 하이라이트 (중앙 오프셋 밝은 타원) ──
        const highlight = new THREE.Mesh(
            new THREE.CircleGeometry(0.55, 24),
            new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.22
            })
        );
        highlight.rotation.x = -Math.PI / 2;
        highlight.position.set(px + 0.35, 0.04, pz - 0.35);
        scene.add(highlight);

        // ── 작은 반사 하이라이트 2 ──
        const highlight2 = new THREE.Mesh(
            new THREE.CircleGeometry(0.22, 16),
            new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.30
            })
        );
        highlight2.rotation.x = -Math.PI / 2;
        highlight2.position.set(px - 0.6, 0.04, pz + 0.6);
        scene.add(highlight2);

        // ── 얼음 색 포인트 조명 ──
        const light = new THREE.PointLight(0x88ccff, 1.4, this.ICE_RADIUS * 2.5);
        light.position.set(px, 0.6, pz);
        scene.add(light);

        _iceZones.push({
            iceMesh, crackLines, rim1, rim2, highlight, highlight2, light,
            position:  new THREE.Vector3(px, 0, pz),
            radius:    this.ICE_RADIUS,
            turnsLeft: this.TURNS_DURATION
        });

        skillManager.markSkillUsed(state.currentTurn, this.id);
        this.previewMesh.visible = false;

        this._endTurn();
        return true;
    }

    // ── 중심에서 방사형으로 뻗는 얼음 균열선 ────────────────────────
    _buildCracks(cx, cz) {
        const lines   = [];
        const count   = 8;
        const mat     = new THREE.LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.38
        });

        for (let i = 0; i < count; i++) {
            const baseAngle = (i / count) * Math.PI * 2;
            const angle = baseAngle + (Math.random() - 0.5) * 0.5;
            const len   = this.ICE_RADIUS * (0.45 + Math.random() * 0.52);
            const segs  = 3 + Math.floor(Math.random() * 3);

            const pts = [new THREE.Vector3(cx, 0.03, cz)];
            for (let s = 1; s <= segs; s++) {
                const frac   = s / segs;
                const jitter = (Math.random() - 0.5) * 0.28;
                pts.push(new THREE.Vector3(
                    cx + Math.cos(angle + jitter * frac) * len * frac,
                    0.03,
                    cz + Math.sin(angle + jitter * frac) * len * frac
                ));
            }
            lines.push(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts),
                mat.clone()
            ));

            // 짧은 가지선 (중간쯤에서 분기)
            if (Math.random() < 0.5) {
                const branchStart = pts[Math.floor(segs * 0.5)];
                const bAngle = angle + (Math.random() > 0.5 ? 0.5 : -0.5);
                const bLen   = len * 0.35;
                const bPts   = [branchStart.clone()];
                for (let b = 1; b <= 2; b++) {
                    const bf = b / 2;
                    bPts.push(new THREE.Vector3(
                        branchStart.x + Math.cos(bAngle) * bLen * bf,
                        0.03,
                        branchStart.z + Math.sin(bAngle) * bLen * bf
                    ));
                }
                const branchMat = new THREE.LineBasicMaterial({
                    color: 0xddeeff, transparent: true, opacity: 0.28
                });
                lines.push(new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(bPts),
                    branchMat
                ));
            }
        }
        return lines;
    }

    updateVFX(deltaTime) {
        this._time += deltaTime || 0.016;
        if (_iceZones.length === 0) return;
        if (state.gameState !== "MOVING" && state.gameState !== "AIMING") return;

        // 물리: 빙판 위 돌은 미끄럽게
        objects.forEach(obj => {
            if (!obj.active) return;
            let onIce = false;
            for (const zone of _iceZones) {
                const dx = obj.mesh.position.x - zone.position.x;
                const dz = obj.mesh.position.z - zone.position.z;
                if (Math.sqrt(dx * dx + dz * dz) < zone.radius) { onIce = true; break; }
            }
            obj.body.setLinearDamping(onIce ? ICE_DAMPING : NORMAL_DAMPING);
        });

        // 빙판 반짝임 애니메이션
        _iceZones.forEach(z => {
            if (z.highlight) {
                z.highlight.material.opacity = 0.12 + 0.12 * Math.sin(this._time * 2.1 + z.position.x);
            }
            if (z.highlight2) {
                z.highlight2.material.opacity = 0.18 + 0.14 * Math.sin(this._time * 3.3 + z.position.z);
            }
            if (z.light) {
                z.light.intensity = 1.0 + 0.4 * Math.sin(this._time * 1.8 + z.position.x * 0.5);
            }
        });
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
        // 모든 돌 감쇠 복원
        objects.forEach(obj => { if (obj.active) obj.body.setLinearDamping(NORMAL_DAMPING); });

        for (let i = _iceZones.length - 1; i >= 0; i--) {
            _iceZones[i].turnsLeft--;
            if (_iceZones[i].turnsLeft <= 0) {
                const z = _iceZones[i];
                scene.remove(z.iceMesh);
                z.crackLines.forEach(l => { scene.remove(l); });
                scene.remove(z.rim1);
                scene.remove(z.rim2);
                scene.remove(z.highlight);
                scene.remove(z.highlight2);
                scene.remove(z.light);
                _iceZones.splice(i, 1);
            }
        }
        if (this.previewMesh) {
            scene.remove(this.previewMesh);
            this.previewMesh.geometry.dispose();
            this.previewMesh.material.dispose();
            this.previewMesh = null;
        }
    }

    clearAll() {
        objects.forEach(obj => { if (obj.active) obj.body.setLinearDamping(NORMAL_DAMPING); });
        _iceZones.forEach(z => {
            scene.remove(z.iceMesh);
            z.crackLines.forEach(l => scene.remove(l));
            scene.remove(z.rim1);
            scene.remove(z.rim2);
            scene.remove(z.highlight);
            scene.remove(z.highlight2);
            scene.remove(z.light);
        });
        _iceZones.length = 0;
    }
}
