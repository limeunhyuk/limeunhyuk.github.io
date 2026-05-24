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

    // Rhythm Game
    rhythmActive: false,
    ringSize: 250,
    rhythmSpeed: 1.0,

    // Interaction
    draggedStone: null,
    
    // Camera
    currentCamPos: { x: 0, y: 40, z: 0 },
    currentCamLook: { x: 0, y: 0, z: 0 },
    targetCamPos: { x: 0, y: 40, z: 0 },
    targetCamLook: { x: 0, y: 0, z: 0 },

    // Tracking for Lock-On
    lockedPair: null
};
