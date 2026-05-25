import { BaseSkill } from './BaseSkill.js';
import { objects } from '../stone.js';
import { createHitEffect } from '../skillsVFX.js';
import * as THREE from 'three';

/**
 * RepulseSkill
 * Role: Applies a radial push force to all nearby opponent stones on impact.
 */
export class RepulseSkill extends BaseSkill {
    constructor() {
        super("REPULSE", "충격파 (Repulse)");
    }

    onCollision(attacker, defender, midPoint) {
        const v1 = attacker.prevLinvel || attacker.body.linvel();
        const v2 = defender.prevLinvel || defender.body.linvel();
        const speed1 = v1.x*v1.x + v1.z*v1.z;
        const speed2 = v2.x*v2.x + v2.z*v2.z;
        
        const attackerStone = speed1 > speed2 ? attacker : defender;

        for (let i = 0; i < 3; i++) createHitEffect(midPoint); 

        const radius = 5.0;
        const repulseForce = 35.0;
        
        objects.forEach(obj => {
            if (obj.active && obj.color !== attackerStone.color) {
                const dist = obj.mesh.position.distanceTo(midPoint);
                if (dist < radius) {
                    const dir = new THREE.Vector3().subVectors(obj.mesh.position, midPoint);
                    dir.y = 0;
                    if (dir.lengthSq() < 0.001) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
                    dir.normalize();
                    
                    const force = repulseForce * Math.pow(1.0 - (dist / radius), 1.5);
                    obj.body.applyImpulse({ x: dir.x * force, y: 0, z: dir.z * force }, true);
                }
            }
        });
    }
}
