import { BaseSkill } from './BaseSkill.js';
import { createHitEffect } from '../skillsVFX.js';

/**
 * DefaultSkill
 * Role: Standard collision behavior with hit particles.
 */
export class DefaultSkill extends BaseSkill {
    constructor() {
        super("NONE", "기본 (None)");
    }

    onCollision(attacker, defender, midPoint) {
        createHitEffect(midPoint);
    }
}
