/**
 * main.js
 * Role: Application Entry Point and Orchestrator.
 * Functions:
 * - init(): Bootstraps the engine, assets, UI, and animation loop.
 * - startGame(): Initializes a new match with the specified stone counts.
 */
import { state } from './src/state.js';
import { loadAssets } from './src/assets.js';
import { initEngine, scene, renderer } from './src/engine.js';
import { createEnvironment } from './src/environment.js';
import { createStones, clearStones } from './src/stone.js';
import { initUI, updateStatusUI, resetSkillUI } from './src/ui.js';
import { initInteraction } from './src/interaction.js';
import { skillManager } from './src/SkillManager.js';
import { animate } from './src/gameManager.js';
import { initCameraManager, setCameraMode, snapCameraTo, CAMERA_MODES } from './src/cameraManager.js';
import * as THREE from 'three';

async function init() {
    // 1. Initialize Engine (Rapier & Three.js)
    await initEngine();

    // 2. Initialize Camera Manager
    initCameraManager(scene, renderer.domElement);

    // 3. Preload Assets (Textures & GLB Models)
    await loadAssets();

    // 4. Register Skills
    skillManager.initSkills();

    // 5. Create Environment
    createEnvironment();

    // 6. Initialize Interaction (Pointer Events)
    initInteraction();

    // 7. Initialize UI
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
        onSkillSelect: (skillId, target) => {
            if (state.gameState !== "AIMING") return;
            
            document.querySelectorAll('.skill-opt').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            
            skillManager.setSkill(skillId);
        }
    });

    // 8. Start Animation Loop
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
    
    snapCameraTo(new THREE.Vector3(0, 40, 0), new THREE.Vector3(0, 0, 0));
    setCameraMode(CAMERA_MODES.ORBITCONTROL);
}

init().catch(e => console.error(e));
