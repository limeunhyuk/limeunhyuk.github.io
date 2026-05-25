/**
 * src/SkillManager.js
 * Role: Skill registry & event dispatcher.
 */
import { state } from './state.js';
import { DefaultSkill } from './skills/DefaultSkill.js';
import { TeleportSkill } from './skills/TeleportSkill.js';
import { DestroySkill } from './skills/DestroySkill.js';
import { RepulseSkill } from './skills/RepulseSkill.js';
import { RhythmSkill } from './skills/RhythmSkill.js';
import { WallSkill } from './skills/WallSkill.js';

export class SkillManager {
    constructor() {
        this.skills = new Map();     // ID-based skill registry
        this.currentSkillId = "NONE"; // Currently selected skill ID
        this.executingSkillId = null; // Skill currently showing VFX
    }

    /** 가용 스킬 인스턴스들을 생성하고 등록 */
    initSkills() {
        this.registerSkill(new DefaultSkill());
        this.registerSkill(new TeleportSkill());
        this.registerSkill(new DestroySkill());
        this.registerSkill(new RepulseSkill());
        this.registerSkill(new RhythmSkill());
        this.registerSkill(new WallSkill());
    }

    registerSkill(skill) {
        this.skills.set(skill.id, skill);
    }

    /** 활성 스킬을 변경하고 전역 상태와 동기화 (UI 업데이트용) */
    setSkill(id) {
        if (this.currentSkillId === id) return;

        const prevSkill = this.skills.get(this.currentSkillId);
        if (prevSkill) prevSkill.onDeactivate();

        this.currentSkillId = id;
        state.currentSkill = id; 

        const newSkill = this.skills.get(id);
        if (newSkill) newSkill.onActivate();
    }

    get currentSkill() {
        return this.skills.get(this.currentSkillId);
    }

    /** onInteract 방식을 사용하는 스킬들을 위한 하위 호환성 유지 */
    handleInteraction(intersects, pointerPos, selectionRing) {
        if (this.currentSkill) {
            return this.currentSkill.onInteract(intersects, pointerPos, selectionRing);
        }
        return false;
    }

    /** interaction.js에서 전달된 포인터 이벤트를 활성 스킬로 라우팅 */
    handlePointerDown(intersects, pointerPos) {
        if (this.currentSkill) {
            return this.currentSkill.onPointerDown(intersects, pointerPos);
        }
        return false;
    }

    handlePointerMove(intersects, pointerPos) {
        if (this.currentSkill) {
            return this.currentSkill.onPointerMove(intersects, pointerPos);
        }
        return false;
    }

    handlePointerUp(intersects, pointerPos) {
        if (this.currentSkill) {
            return this.currentSkill.onPointerUp(intersects, pointerPos);
        }
        return false;
    }

    /** 물리 충돌 발생 시 활성 스킬의 효과 발동 */
    handleCollision(attacker, defender, midPoint) {
        if (this.currentSkill) {
            this.executingSkillId = this.currentSkillId;
            this.currentSkill.onCollision(attacker, defender, midPoint);
        }
    }

    /** 매 프레임 모든 스킬의 내부 로직/VFX 업데이트 (예: 리듬 게임 링 축소) */
    updateVFX(deltaTime) {
        for (const skill of this.skills.values()) {
            skill.updateVFX(deltaTime);
        }
    }

    /** 턴이 끝날 때 모든 스킬의 잔여 물리체/리소스 정리 및 'NONE'으로 복구 */
    resetTurn() {
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
