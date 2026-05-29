/**
 * src/skills/BlindSkill.js  [방해 스킬 2/5]
 * - 설치 즉시 턴 종료
 * - 진한 어둠 구체 → 그 구역이 거의 안 보임
 * - 1번 resetTurn 후 사라짐 (상대 1턴 동안 유지)
 * - 시각: 회전 이벤트 호라이즌 링 + 공전 어둠 구슬 + 맥동 외피
 */
import * as THREE from 'three';
import { BaseSkill } from './BaseSkill.js';
import { state }     from '../state.js';
import { scene }     from '../engine.js';
import { skillManager } from '../SkillManager.js';

const _blindZones = [];

export class BlindSkill extends BaseSkill {
    constructor() {
        super("BLIND", "🌑 시야차단 (Blind)", "DISRUPTION");
        this.previewMesh    = null;
        this.BLIND_RADIUS   = 2.5;
        this.BOARD_LIMIT    = 7.0;
        this.TURNS_DURATION = 1;   // 상대 1턴만 유지
        this._time          = 0;
    }

    onActivate() {
        const geo = new THREE.SphereGeometry(this.BLIND_RADIUS, 20, 10);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x000000, transparent: true, opacity: 0.75
        });
        this.previewMesh = new THREE.Mesh(geo, mat);
        this.previewMesh.visible = false;
        scene.add(this.previewMesh);
    }

    onPointerMove(intersects, pointerPos) {
        if (!this.previewMesh) return false;
        const px = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.x));
        const pz = Math.max(-this.BOARD_LIMIT, Math.min(this.BOARD_LIMIT, pointerPos.z));
        this.previewMesh.position.set(px, 1.5, pz);
        this.previewMesh.visible = true;
        return false;
    }

    onPointerDown(intersects, pointerPos) {
        if (!this.previewMesh?.visible) return false;

        const px = this.previewMesh.position.x;
        const pz = this.previewMesh.position.z;

        // ── 핵심: 거의 완전 불투명 어둠 구체 ──
        const core = new THREE.Mesh(
            new THREE.SphereGeometry(this.BLIND_RADIUS, 24, 12),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.97 })
        );
        core.position.set(px, 1.5, pz);
        scene.add(core);

        // ── 바닥 원판 (아래도 가리기) ──
        const floor = new THREE.Mesh(
            new THREE.CylinderGeometry(this.BLIND_RADIUS, this.BLIND_RADIUS, 0.1, 36),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.97 })
        );
        floor.position.set(px, 0.05, pz);
        scene.add(floor);

        // ── 외곽 보라 글로우 (BackSide) ──
        const edge = new THREE.Mesh(
            new THREE.SphereGeometry(this.BLIND_RADIUS + 0.2, 20, 10),
            new THREE.MeshBasicMaterial({
                color: 0x2a0040, transparent: true, opacity: 0.35, side: THREE.BackSide
            })
        );
        edge.position.set(px, 1.5, pz);
        scene.add(edge);

        // ── 이벤트 호라이즌 링 1 (수평 회전) ──
        const horizon1 = new THREE.Mesh(
            new THREE.TorusGeometry(this.BLIND_RADIUS * 0.78, 0.11, 8, 52),
            new THREE.MeshBasicMaterial({ color: 0x550077, transparent: true, opacity: 0.82 })
        );
        horizon1.position.set(px, 1.5, pz);
        scene.add(horizon1);

        // ── 이벤트 호라이즌 링 2 (기울어진 두 번째 링) ──
        const horizon2 = new THREE.Mesh(
            new THREE.TorusGeometry(this.BLIND_RADIUS * 0.60, 0.07, 8, 48),
            new THREE.MeshBasicMaterial({ color: 0x330055, transparent: true, opacity: 0.65 })
        );
        horizon2.position.set(px, 1.5, pz);
        horizon2.rotation.x = Math.PI / 3;
        scene.add(horizon2);

        // ── 맥동 외피 (바깥쪽, 크게 반짝임) ──
        const pulseShell = new THREE.Mesh(
            new THREE.SphereGeometry(this.BLIND_RADIUS + 0.45, 20, 10),
            new THREE.MeshBasicMaterial({
                color: 0x0d0011, transparent: true, opacity: 0.06, side: THREE.BackSide
            })
        );
        pulseShell.position.set(px, 1.5, pz);
        scene.add(pulseShell);

        // ── 공전 어둠 구슬 3개 ──
        const orbs    = [];
        const orbStartAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
        const orbR    = this.BLIND_RADIUS * 0.76;
        for (let i = 0; i < 3; i++) {
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.20, 10, 6),
                new THREE.MeshBasicMaterial({ color: 0x1a0026, transparent: true, opacity: 0.92 })
            );
            const a = orbStartAngles[i];
            orb.position.set(px + Math.cos(a) * orbR, 1.5, pz + Math.sin(a) * orbR);
            scene.add(orb);
            orbs.push(orb);
        }

        // ── 어둠 속 희미한 보라 조명 ──
        const light = new THREE.PointLight(0x440066, 1.0, this.BLIND_RADIUS * 2.2);
        light.position.set(px, 2.0, pz);
        scene.add(light);

        const center = new THREE.Vector3(px, 1.5, pz);
        _blindZones.push({
            core, floor, edge, light,
            horizon1, horizon2,
            pulseShell,
            orbs, orbStartAngles,
            center,
            turnsLeft: this.TURNS_DURATION
        });

        skillManager.markSkillUsed(state.currentTurn, this.id);
        this.previewMesh.visible = false;

        this._endTurn();
        return true;
    }

    updateVFX(deltaTime) {
        this._time += deltaTime || 0.016;
        if (_blindZones.length === 0) return;

        const t = this._time;
        const orbR = this.BLIND_RADIUS * 0.76;

        _blindZones.forEach(zone => {
            // 이벤트 호라이즌 링 1: Y축 빠른 회전
            zone.horizon1.rotation.y = t * 1.4;
            // Z축 흔들림으로 기울기 변화
            zone.horizon1.rotation.z = Math.sin(t * 0.55) * 0.45;

            // 이벤트 호라이즌 링 2: 반대 방향 느리게 회전
            zone.horizon2.rotation.y = -t * 0.85;
            zone.horizon2.rotation.x = Math.PI / 3 + Math.sin(t * 0.7) * 0.2;

            // 맥동 외피: 천천히 팽창/수축
            const pulse = 0.03 + 0.09 * Math.abs(Math.sin(t * 1.3 + zone.center.x * 0.5));
            zone.pulseShell.material.opacity = pulse;
            const s = 1.0 + 0.04 * Math.sin(t * 1.3 + zone.center.x * 0.5);
            zone.pulseShell.scale.setScalar(s);

            // 어둠 구슬 3개 공전 (속도 다름, 상하 진동)
            zone.orbs.forEach((orb, i) => {
                const speed  = 0.9 + i * 0.18;
                const angle  = zone.orbStartAngles[i] + t * speed;
                const yBob   = 0.30 * Math.sin(t * 1.6 + i * 2.1);
                orb.position.set(
                    zone.center.x + Math.cos(angle) * orbR,
                    zone.center.y + yBob,
                    zone.center.z + Math.sin(angle) * orbR
                );
            });

            // 조명 맥동
            if (zone.light) {
                zone.light.intensity = 0.6 + 0.55 * Math.abs(Math.sin(t * 2.2));
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
        for (let i = _blindZones.length - 1; i >= 0; i--) {
            _blindZones[i].turnsLeft--;
            if (_blindZones[i].turnsLeft <= 0) {
                const z = _blindZones[i];
                scene.remove(z.core);
                scene.remove(z.floor);
                scene.remove(z.edge);
                scene.remove(z.light);
                scene.remove(z.horizon1);
                scene.remove(z.horizon2);
                scene.remove(z.pulseShell);
                z.orbs.forEach(o => scene.remove(o));
                _blindZones.splice(i, 1);
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
        _blindZones.forEach(z => {
            scene.remove(z.core);
            scene.remove(z.floor);
            scene.remove(z.edge);
            scene.remove(z.light);
            scene.remove(z.horizon1);
            scene.remove(z.horizon2);
            scene.remove(z.pulseShell);
            z.orbs.forEach(o => scene.remove(o));
        });
        _blindZones.length = 0;
    }
}
