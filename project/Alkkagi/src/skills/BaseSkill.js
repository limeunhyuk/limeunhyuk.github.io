/**
 * src/skills/BaseSkill.js
 * Role: Base class defining the interface for all skills.
 */

export class BaseSkill {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }

    /**
     * Called when the skill is selected in the UI.
     */
    onActivate() {}

    /**
     * Called when another skill is selected or turn ends.
     */
    onDeactivate() {}

    /**
     * Called during pointer events (AIMING state).
     * @deprecated Use onPointerDown/Move/Up instead.
     * @returns {boolean} - Returns true if the skill handled the interaction and wants to prevent default dragging.
     */
    onInteract(intersects, pointerPos, selectionRing) {
        return false;
    }

    /**
     * Pointer Down Hook
     * @returns {boolean} True if the skill intercepted the event.
     */
    onPointerDown(intersects, pointerPos) { return false; }

    /**
     * Pointer Move Hook
     * @returns {boolean} True if the skill intercepted the event.
     */
    onPointerMove(intersects, pointerPos) { return false; }

    /**
     * Pointer Up Hook
     * @returns {boolean} True if the skill intercepted the event.
     */
    onPointerUp(intersects, pointerPos) { return false; }

    /**
     * Called when a collision occurs (MOVING state).
     * @param {object} attacker - The moving stone object.
     * @param {object} defender - The hit stone object.
     * @param {THREE.Vector3} midPoint - The collision position.
     */
    onCollision(attacker, defender, midPoint) {}

    /**
     * Called every frame from the animation loop.
     * @param {number} deltaTime - Time elapsed since last frame.
     */
    updateVFX(deltaTime) {}

    /**
     * Called when the skill is destroyed or game resets.
     */
    dispose() {}
}
