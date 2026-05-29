import { BaseSkill } from './BaseSkill.js';
import { createHitEffect } from '../skillsVFX.js';

/**
 * DefaultSkill
 * Role: Standard collision behavior with hit particles.
 */
export class DefaultSkill extends BaseSkill {
    constructor() {
        super("NONE", "기본 (None)", null); // null = 그룹 없음, 취소 버튼으로만 표시
    }

    onCollision(attacker, defender, midPoint) {
        createHitEffect(midPoint);
    }
}
