/**
 * src/skills/BaseSkill.js
 * Role: Base class defining the interface for all skills.
 */

export class BaseSkill {
    /**
     * @param {string} id     - Unique skill identifier (e.g. "MINE")
     * @param {string} name   - Display name shown in UI
     * @param {string} group  - 'ATTACK' | 'DISRUPTION' | null (for NONE/default)
     */
    constructor(id, name, group = 'ATTACK') {
        this.id = id;
        this.name = name;
        this.group = group;
    }

    /** Called when the skill is selected in the UI. */
    onActivate() {}

    /** Called when another skill is selected or turn ends. */
    onDeactivate() {}

    /**
     * Called during pointer events (AIMING state).
     * @deprecated Use onPointerDown/Move/Up instead.
     * @returns {boolean} True to prevent default dragging.
     */
    onInteract(intersects, pointerPos, selectionRing) { return false; }

    /** @returns {boolean} True if the skill intercepted the event. */
    onPointerDown(intersects, pointerPos) { return false; }

    /** @returns {boolean} True if the skill intercepted the event. */
    onPointerMove(intersects, pointerPos) { return false; }

    /** @returns {boolean} True if the skill intercepted the event. */
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

    /** Called every turn end — cleans up per-turn resources (previews, walls, etc.). */
    dispose() {}

    /**
     * Called on game restart — removes ALL persistent effects (mines, blind zones…).
     * Override in skills that have module-level persistent state.
     */
    clearAll() {}
}
