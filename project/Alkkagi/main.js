/**
 * main.js
 * Role: Entry point & Bootstrapping orchestrator.
 */
import { state } from './src/state.js';
import { loadAssets } from './src/assets.js';
import { initEngine, scene, renderer } from './src/engine.js';
import { createEnvironment } from './src/environment.js';
import { createStones, clearStones } from './src/stone.js';
import { initUI, updateStatusUI, resetSkillUI, toggleGameUI, updateSkillAvailabilityUI } from './src/ui.js';
import { initInteraction } from './src/interaction.js';
import { skillManager } from './src/SkillManager.js';
import { animate } from './src/gameManager.js';
import { initCameraManager, setCameraMode, snapCameraTo, CAMERA_MODES } from './src/cameraManager.js';
import { showFormationScreen } from './src/formation.js';
import * as THREE from 'three';

/**
 * 마지막으로 사용한 돌 개수 (재시작 시 재활용)
 */
let _lastBCount = 10;
let _lastWCount = 10;

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
        /** "다음 →" 버튼: 돌 개수 확정 후 포진 선택 화면으로 */
        onStart: () => {
            const inputBlack = document.getElementById('input-black');
            const inputWhite = document.getElementById('input-white');
            const bCount = Math.max(1, parseInt(inputBlack?.value) || 10);
            const wCount = Math.max(1, parseInt(inputWhite?.value) || 10);

            _lastBCount = bCount;
            _lastWCount = wCount;

            const startScreen = document.getElementById('start-screen');
            if (startScreen) startScreen.style.display = 'none';

            // 뒤로 버튼 연결 후 포진 선택 화면 표시
            _bindFormationBackButton();
            showFormationScreen(bCount, wCount, startGame);
        },

        /** 게임 오버 화면 "다시하기": 포진 선택부터 */
        onRestart: () => {
            const gameOverScreen = document.getElementById('game-over-screen');
            if (gameOverScreen) gameOverScreen.style.display = 'none';
            _bindFormationBackButton(/* 뒤로 가면 시작화면 */);
            showFormationScreen(_lastBCount, _lastWCount, startGame);
        },

        /** 게임 오버 화면 "시작 화면": 처음으로 돌아가기 */
        onToStart: () => {
            const gameOverScreen = document.getElementById('game-over-screen');
            const startScreen = document.getElementById('start-screen');
            const formationScreen = document.getElementById('formation-screen');

            if (gameOverScreen)   gameOverScreen.style.display = 'none';
            if (formationScreen)  formationScreen.style.display = 'none';
            if (startScreen)      startScreen.style.display = 'flex';

            toggleGameUI(false);
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

    animate(0);
}

/** 포진 선택 화면의 "← 뒤로" 버튼을 시작 화면으로 돌아가도록 연결 */
function _bindFormationBackButton() {
    const btn = document.getElementById('btn-formation-back');
    if (!btn) return;
    btn.onclick = () => {
        const formationScreen = document.getElementById('formation-screen');
        const startScreen = document.getElementById('start-screen');
        if (formationScreen) formationScreen.style.display = 'none';
        if (startScreen)     startScreen.style.display = 'flex';
    };
}

/**
 * 경기 시작 및 초기화 로직
 * @param {number} bCount
 * @param {number} wCount
 * @param {Array<{x:number,z:number}>} bPositions - 흑돌 좌표 배열
 * @param {Array<{x:number,z:number}>} wPositions - 백돌 좌표 배열
 */
function startGame(bCount, wCount, bPositions, wPositions) {
    _lastBCount = bCount;
    _lastWCount = wCount;

    // ── 스킬 사용 기록 초기화 (새 게임마다 리셋) ──
    state.usedSkills.black.clear();
    state.usedSkills.white.clear();
    state.disruptionUsedLastTurn = false;
    skillManager.clearAllPersistentEffects();

    toggleGameUI(true);

    createStones(bCount, wCount, bPositions, wPositions);
    state.currentTurn = "black";
    updateStatusUI();

    state.gameState = "AIMING";
    state.firstCollisionOccurred = false;

    resetSkillUI();

    snapCameraTo(new THREE.Vector3(0, 40, 0), new THREE.Vector3(0, 0, 0));
    setCameraMode(CAMERA_MODES.DEFAULT);
}

init().catch(e => console.error(e));
