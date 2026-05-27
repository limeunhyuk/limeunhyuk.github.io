import { BaseSkill } from './BaseSkill.js';
import { createHitEffect } from '../skillsVFX.js';

/**
 * DestroySkill
 * Role: Instantly removes the hit opponent stone from the board.
 */
export class DestroySkill extends BaseSkill {
    constructor() {
        super("DESTROY", "즉사 (Destroy)");
    }

    onCollision(attacker, defender, midPoint) {
        // Find which stone was the target (the one with lower speed)
        const v1 = attacker.prevLinvel || attacker.body.linvel();
        const v2 = defender.prevLinvel || defender.body.linvel();
        const speed1 = v1.x*v1.x + v1.z*v1.z;
        const speed2 = v2.x*v2.x + v2.z*v2.z;
        
        const defenderStone = speed1 > speed2 ? defender : attacker;

        for (let i = 0; i < 3; i++) createHitEffect(midPoint); 
        
        // Push defender stone deep underground to "destroy" it
        defenderStone.body.setTranslation({ 
            x: defenderStone.mesh.position.x, 
            y: -10, 
            z: defenderStone.mesh.position.z 
        }, true);
    }
}
