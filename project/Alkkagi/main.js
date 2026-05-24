/**
 * main.js
 * Role: Application Entry Point and Orchestrator.
 * Functions:
 * - init(): Bootstraps the engine, assets, UI, and animation loop.
 * - startGame(): Initializes a new match with the specified stone counts.
 */
import { state } from './src/state.js';
import { loadAssets } from './src/assets.js';
import { initEngine, camera } from './src/engine.js';
import { createEnvironment } from './src/environment.js';
import { createStones, clearStones } from './src/stone.js';
import { initUI, updateStatusUI, resetSkillUI } from './src/ui.js';
import { initInteraction, selectionRing } from './src/interaction.js';
import { checkRhythmTiming } from './src/skills.js';
import { animate } from './src/gameManager.js';

async function init() {
    // Initialize Engine (Rapier & Three.js)
    await initEngine();

    // Preload Assets (Textures & GLB Models)
    await loadAssets();

    // Create Environment
    createEnvironment();

    // Initialize Interaction (Pointer Events)
    initInteraction();

    // Initialize UI
    initUI({
        onStart: startGame,
        onRestart: () => {
            const gameOverScreen = document.getElementById('game-over-screen');
            if (gameOverScreen) gameOverScreen.style.display = 'none';
            startGame();
        },
        onToStart: () => {
            const gameOverScreen = document.getElementById('game-over-screen');
            const startScreen = document.getElementById('start-screen');
            const uiContainer = document.getElementById('ui-container');
            const statusContainer = document.getElementById('status-container');
            const skillSelector = document.getElementById('skill-selector');

            if (gameOverScreen) gameOverScreen.style.display = 'none';
            if (startScreen) startScreen.style.display = 'flex';
            if (uiContainer) uiContainer.style.display = 'none';
            if (statusContainer) statusContainer.style.display = 'none';
            if (skillSelector) skillSelector.style.display = 'none';
            
            clearStones();
            state.gameState = "MENU";
        },
        onSkillSelect: (skill, target) => {
            if (state.gameState !== "AIMING") return;
            
            document.querySelectorAll('.skill-opt').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            
            state.currentSkill = skill;
            state.teleportSelectedStone = null;
            if (selectionRing) selectionRing.visible = false;
        }
    });

    // Global Key Listeners (Rhythm Game)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && state.rhythmActive) {
            checkRhythmTiming();
        }
    });

    // Start Animation Loop
    animate();
}

function startGame() {
    const inputBlack = document.getElementById('input-black');
    const inputWhite = document.getElementById('input-white');
    const bCount = parseInt(inputBlack?.value) || 10;
    const wCount = parseInt(inputWhite?.value) || 10;
    
    const startScreen = document.getElementById('start-screen');
    const uiContainer = document.getElementById('ui-container');
    const statusContainer = document.getElementById('status-container');
    const skillSelector = document.getElementById('skill-selector');

    if (startScreen) startScreen.style.display = 'none';
    if (uiContainer) uiContainer.style.display = 'block';
    if (statusContainer) statusContainer.style.display = 'block';
    
    createStones(bCount, wCount);
    state.currentTurn = "black";
    updateStatusUI();
    
    state.gameState = "AIMING";
    state.firstCollisionOccurred = false;
    
    if (skillSelector) skillSelector.style.display = 'block';
    resetSkillUI();
    
    state.currentCamPos = { x: 0, y: 40, z: 0 };
    state.currentCamLook = { x: 0, y: 0, z: 0 };
    camera.position.set(0, 40, 0);
    camera.lookAt(0, 0, 0);
}

init().catch(e => console.error(e));
