/**
 * src/SkillManager.js
 * Role: Central registry and dispatcher for all skills.
 */
import { DefaultSkill } from './skills/DefaultSkill.js';
import { TeleportSkill } from './skills/TeleportSkill.js';
import { DestroySkill } from './skills/DestroySkill.js';
import { RepulseSkill } from './skills/RepulseSkill.js';
import { RhythmSkill } from './skills/RhythmSkill.js';

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
    }

    registerSkill(skill) {
        this.skills.set(skill.id, skill);
    }

    setSkill(id) {
        if (this.currentSkillId === id) return;

        const prevSkill = this.skills.get(this.currentSkillId);
        if (prevSkill) prevSkill.onDeactivate();

        this.currentSkillId = id;
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

    getRegisteredSkills() {
        return Array.from(this.skills.values());
    }
}

export const skillManager = new SkillManager();
