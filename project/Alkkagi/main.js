/**
 * main.js
 * Role: Entry point & Bootstrapping orchestrator.
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

/**
 * Bootstrapping sequence:
 * Engine -> Camera -> Assets -> Skills -> Env -> Interaction -> UI -> Loop.
 */
async function init() {
    await initEngine();
    initCameraManager(scene, renderer.domElement);
    await loadAssets();
    skillManager.initSkills();
    createEnvironment();
    initInteraction();

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

    animate();
}

/** 경기 시작 및 초기화 로직 */
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
