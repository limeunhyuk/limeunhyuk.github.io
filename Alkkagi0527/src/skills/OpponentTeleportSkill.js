/**
 * src/skills/OpponentTeleportSkill.js  [방해 스킬 5/5]
 * Role: 상대 돌 1개를 원하는 위치로 강제 텔레포트한다.
 *
 * 2클릭 흐름:
 *   1) 상대 돌 클릭 → 선택 (빨간 링 표시)
 *   2) 빈 위치 클릭 → 그 위치로 이동, 전기 이펙트 발생, 턴 종료
 *
 * 발사 없이 턴이 끝나므로 skillManager.resetTurn() 을 직접 호출한다.
 */
import * as THREE from 'three';
import { BaseSkill } from './BaseSkill.js';
import { objects }   from '../stone.js';
import { state }     from '../state.js';
import { scene }     from '../engine.js';
import { skillManager }    from '../SkillManager.js';
import { createElectricEffect } from '../skillsVFX.js';

export class OpponentTeleportSkill extends BaseSkill {
    constructor() {
        super("OPPONENT_TELEPORT", "⚡ 강제 이동", "DISRUPTION");
        this.phase         = 'SELECT'; // 'SELECT' | 'PLACE'
        this.selectedStone = null;
        this.hoverRing     = null;
        this.selectionRing = null;
        this.BOARD_LIMIT   = 7.0;
    }

    onActivate() {
        this.phase = 'SELECT';
        this.selectedStone = null;

        // 호버 링 (빨강 — 상대 돌에 마우스 올렸을 때)
        this.hoverRing = new THREE.Mesh(
            new THREE.RingGeometry(0.55, 0.72, 40),
            new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
        );
        this.hoverRing.rotation.x = -Math.PI / 2;
        this.hoverRing.visible = false;
        scene.add(this.hoverRing);

        // 선택 링 (주황 — 클릭 후 선택된 돌 표시)
        this.selectionRing = new THREE.Mesh(
            new THREE.RingGeometry(0.55, 0.72, 40),
            new THREE.MeshBasicMaterial({ color: 0xff8800, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
        );
        this.selectionRing.rotation.x = -Math.PI / 2;
        this.selectionRing.visible = false;
        scene.add(this.selectionRing);
    }

    /** GLB 자식 메쉬도 처리: hit 메쉬에서 부모를 타고 올라가 stone 객체 탐색 */
    _findStone(hitMesh) {
        return objects.find(o => {
            if (!o.active) return false;
            let node = hitMesh;
            while (node) {
                if (node === o.mesh) return true;
                node = node.parent;
            }
            return false;
        });
    }

    onPointerMove(intersects, pointerPos) {
        if (this.phase !== 'SELECT') return false;

        this.hoverRing.visible = false;
        if (intersects.length > 0) {
            const stone = this._findStone(intersects[0].object);
            if (stone && stone.color !== state.currentTurn) {
                this.hoverRing.position.set(stone.mesh.position.x, 0.05, stone.mesh.position.z);
                this.hoverRing.visible = true;
            }
        }
        return false;
    }

    onPointerDown(intersects, pointerPos) {
        // ── 1단계: 상대 돌 선택 ──────────────────────────────
        if (this.phase === 'SELECT') {
            if (intersects.length > 0) {
                const stone = this._findStone(intersects[0].object);
                if (stone && stone.color !== state.currentTurn) {
                    this.selectedStone = stone;
                    this.phase = 'PLACE';
                    this.selectionRing.position.set(stone.mesh.position.x, 0.05, stone.mesh.position.z);
                    this.selectionRing.visible = true;
                    this.hoverRing.visible = false;
                    return true;
                }
            }
            return true; // 빈 곳 클릭 → 기본 동작 차단만
        }

        // ── 2단계: 목표 위치 클릭 → 텔레포트 ────────────────
        if (this.phase === 'PLACE' && this.selectedStone) {
            const BL = this.BOARD_LIMIT;
            const tx = Math.max(-BL, Math.min(BL, pointerPos.x));
            const tz = Math.max(-BL, Math.min(BL, pointerPos.z));

            // 이펙트
            createElectricEffect(this.selectedStone.mesh.position.clone());
            createElectricEffect(new THREE.Vector3(tx, 0.125, tz));

            // 돌 이동
            this.selectedStone.body.setTranslation({ x: tx, y: 0.125, z: tz }, true);
            this.selectedStone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            this.selectedStone.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            this.selectedStone.mesh.position.set(tx, 0.125, tz);

            // 사용 마킹
            skillManager.markSkillUsed(state.currentTurn, this.id);

            // 턴 전환 (발사 없이 종료)
            state.currentTurn = state.currentTurn === 'black' ? 'white' : 'black';
            import('../ui.js').then(m => {
                m.updateStatusUI();
                m.resetSkillUI();
                m.updateSkillAvailabilityUI();
            });
            skillManager.resetTurn(); // dispose 포함 (내부에서 disruptionUsedLastTurn=false)
            // resetTurn() 이후에 세팅해야 덮어쓰기 방지
            state.disruptionUsedLastTurn = true; // 상대 다음 턴 방해 스킬 차단

            return true;
        }

        return true;
    }

    updateVFX(deltaTime) {
        const t = Date.now() * 0.005;
        if (this.hoverRing?.visible)
            this.hoverRing.material.opacity = 0.45 + 0.35 * Math.abs(Math.sin(t));
        if (this.selectionRing?.visible)
            this.selectionRing.material.opacity = 0.55 + 0.35 * Math.abs(Math.sin(t * 1.5));
    }

    dispose() {
        this.phase = 'SELECT';
        this.selectedStone = null;
        if (this.hoverRing) {
            scene.remove(this.hoverRing);
            this.hoverRing.geometry.dispose();
            this.hoverRing.material.dispose();
            this.hoverRing = null;
        }
        if (this.selectionRing) {
            scene.remove(this.selectionRing);
            this.selectionRing.geometry.dispose();
            this.selectionRing.material.dispose();
            this.selectionRing = null;
        }
    }
}
