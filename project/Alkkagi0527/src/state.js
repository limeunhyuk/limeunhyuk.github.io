/**
 * src/state.js
 * Role: Central data container for global game state. (No logic allowed)
 */
export const state = {
    // Game Flow
    gameState: "MENU",           // MENU, AIMING, MOVING, ZOOMING_IN/OUT, MINIGAME, GAMEOVER, RETURN_TO_AIM
    currentTurn: "black",
    firstCollisionOccurred: false, // Prevent multiple skill triggers in one turn
    
    // Score & Status
    totalBlack: 10,
    totalWhite: 10,
    currentBlack: 10,
    currentWhite: 10,

    // Physics & Timing
    currentSlowMoFactor: 1.0,    // < 1.0 for slow-motion effect
    frameCount: 0,

    // Skills
    currentSkill: "NONE",        // Selected in UI
    projectileSkill: "NONE",     // Fixed skill to trigger on next collision
    teleportSelectedStone: null,

    // Interaction
    draggedStone: null,
    lockedPair: null,            // Closest pair being tracked by Action Camera

    // Skill usage tracking — each skill usable once per player per game
    usedSkills: { black: new Set(), white: new Set() },

    // 방해 스킬 연속 사용 방지
    // 상대방이 방해 스킬을 쓴 직후 1턴, 현재 플레이어는 방해 스킬 사용 불가
    disruptionUsedLastTurn: false
};
