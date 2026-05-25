/**
 * src/SkillManager.js
 * Role: Central registry and dispatcher for all skills.
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
        this.skills = new Map();
        this.currentSkillId = "NONE";
        this.executingSkillId = null; // Skill whose VFX is playing
    }

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

    setSkill(id) {
        if (this.currentSkillId === id) return;

        const prevSkill = this.skills.get(this.currentSkillId);
        if (prevSkill) prevSkill.onDeactivate();

        this.currentSkillId = id;
        state.currentSkill = id; // Sync with global state

        const newSkill = this.skills.get(id);
        if (newSkill) newSkill.onActivate();
    }

    get currentSkill() {
        return this.skills.get(this.currentSkillId);
    }

    get executingSkill() {
        return this.skills.get(this.executingSkillId);
    }

    handleInteraction(intersects, pointerPos, selectionRing) {
        if (this.currentSkill) {
            return this.currentSkill.onInteract(intersects, pointerPos, selectionRing);
        }
        return false;
    }

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

    handleCollision(attacker, defender, midPoint) {
        if (this.currentSkill) {
            this.executingSkillId = this.currentSkillId;
            this.currentSkill.onCollision(attacker, defender, midPoint);
        }
    }

    updateVFX(deltaTime) {
        // Update all registered skills for VFX that might persist
        for (const skill of this.skills.values()) {
            skill.updateVFX(deltaTime);
        }
    }

    resetExecutingSkill() {
        this.executingSkillId = null;
    }

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
