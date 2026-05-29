/**
 * src/SkillManager.js
 * Role: Skill registry & event dispatcher.
 */
import { state } from './state.js';
import { DefaultSkill }           from './skills/DefaultSkill.js';
import { TeleportSkill }          from './skills/TeleportSkill.js';
import { DestroySkill }           from './skills/DestroySkill.js';
import { RepulseSkill }           from './skills/RepulseSkill.js';
import { RhythmSkill }            from './skills/RhythmSkill.js';
import { WallSkill }              from './skills/WallSkill.js';
import { MineSkill }              from './skills/MineSkill.js';
import { BlindSkill }             from './skills/BlindSkill.js';
import { IceSkill }               from './skills/IceSkill.js';
import { BlackHoleSkill }         from './skills/BlackHoleSkill.js';
import { OpponentTeleportSkill }  from './skills/OpponentTeleportSkill.js';

export class SkillManager {
    constructor() {
        this.skills = new Map();      // ID → skill instance
        this.currentSkillId  = "NONE";
        this.executingSkillId = null;
    }

    /** Register all skill instances */
    initSkills() {
        // ── 공격 스킬 (5) ──────────────────────────────────────
        this.registerSkill(new DefaultSkill());
        this.registerSkill(new TeleportSkill());
        this.registerSkill(new DestroySkill());
        this.registerSkill(new RepulseSkill());
        this.registerSkill(new RhythmSkill());
        this.registerSkill(new WallSkill());
        // ── 방해 스킬 (5) ──────────────────────────────────────
        this.registerSkill(new MineSkill());
        this.registerSkill(new BlindSkill());
        this.registerSkill(new IceSkill());
        this.registerSkill(new BlackHoleSkill());
        this.registerSkill(new OpponentTeleportSkill());
    }

    registerSkill(skill) {
        this.skills.set(skill.id, skill);
    }

    /** 활성 스킬을 변경하고 전역 상태와 동기화 */
    setSkill(id) {
        if (this.currentSkillId === id) return;

        const prev = this.skills.get(this.currentSkillId);
        if (prev) prev.onDeactivate();

        this.currentSkillId = id;
        state.currentSkill  = id;

        const next = this.skills.get(id);
        if (next) next.onActivate();
    }

    get currentSkill() {
        return this.skills.get(this.currentSkillId);
    }

    // ─── Skill usage tracking ────────────────────────────────────

    /**
     * Mark skillId as used by playerColor.
     * Called explicitly when a skill actually executes.
     */
    markSkillUsed(playerColor, skillId) {
        if (!skillId || skillId === 'NONE') return;
        if (!state.usedSkills[playerColor]) return;
        state.usedSkills[playerColor].add(skillId);
    }

    /**
     * Returns true if skillId has already been used by the current player.
     */
    isSkillUsed(skillId) {
        if (!skillId || skillId === 'NONE') return false;
        return state.usedSkills[state.currentTurn]?.has(skillId) ?? false;
    }

    /**
     * Full cleanup for all persistent effects (mines, blind zones, ice…).
     * Call on game restart.
     */
    clearAllPersistentEffects() {
        for (const skill of this.skills.values()) {
            skill.clearAll();
        }
    }

    // ─── Pointer / Interaction routing ───────────────────────────

    /** onInteract 방식을 사용하는 스킬들을 위한 하위 호환성 유지 */
    handleInteraction(intersects, pointerPos, selectionRing) {
        if (this.currentSkill)
            return this.currentSkill.onInteract(intersects, pointerPos, selectionRing);
        return false;
    }

    handlePointerDown(intersects, pointerPos) {
        if (this.currentSkill)
            return this.currentSkill.onPointerDown(intersects, pointerPos);
        return false;
    }

    handlePointerMove(intersects, pointerPos) {
        if (this.currentSkill)
            return this.currentSkill.onPointerMove(intersects, pointerPos);
        return false;
    }

    handlePointerUp(intersects, pointerPos) {
        if (this.currentSkill)
            return this.currentSkill.onPointerUp(intersects, pointerPos);
        return false;
    }

    /** 물리 충돌 발생 시 활성 스킬의 효과 발동 */
    handleCollision(attacker, defender, midPoint) {
        if (this.currentSkill) {
            this.executingSkillId = this.currentSkillId;
            this.currentSkill.onCollision(attacker, defender, midPoint);
        }
    }

    /** 매 프레임 모든 스킬의 내부 로직/VFX 업데이트 */
    updateVFX(deltaTime) {
        for (const skill of this.skills.values()) {
            skill.updateVFX(deltaTime);
        }
    }

    /** 턴이 끝날 때 모든 스킬의 잔여 리소스 정리 및 'NONE'으로 복구 */
    resetTurn() {
        // 방해 스킬 차단 플래그 해제 (상대 1턴이 끝났으므로 복구)
        state.disruptionUsedLastTurn = false;
        for (const skill of this.skills.values()) {
            skill.dispose();
        }
        this.setSkill("NONE");
    }

    getRegisteredSkills() {
        return Array.from(this.skills.values());
    }
}

export const skillManager = new SkillManager();
