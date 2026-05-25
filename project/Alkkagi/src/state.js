/**
 * src/state.js
 * Role: Centralized state object for managing global game variables.
 * - Manages gameState, scores, current turn, camera targets, and slow-motion factors.
 */
export const state = {
    // Game State
    gameState: "MENU", // MENU, AIMING, MOVING, ZOOMING_IN, MINIGAME, ZOOMING_OUT, GAMEOVER, RETURN_TO_AIM
    currentTurn: "black",
    firstCollisionOccurred: false,
    
    // Scores
    totalBlack: 10,
    totalWhite: 10,
    currentBlack: 10,
    currentWhite: 10,

    // Timing & Slow Motion
    currentSlowMoFactor: 1.0,
    frameCount: 0,

    // Skills
    currentSkill: "NONE",
    projectileSkill: "NONE",
    teleportSelectedStone: null,

    // Interaction
    draggedStone: null,
    
    // Tracking for Lock-On
    lockedPair: null
};
