/**
 * @file main.js
 * @description 
 * - 초차원 알까기 프로젝트의 엔트리 포인트
 * - 엔진, 카메라, 에셋, 환경, UI 등 핵심 시스템 초기화 
 * - 게임의 전체적인 흐름(시작, 재시작, 메뉴 복귀 등) 제어
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
import { initWeather } from './src/weather.js';
import { initCameraManager, setCameraMode, snapCameraTo, CAMERA_MODES } from './src/cameraManager.js';
import { showFormationScreen } from './src/formation.js';
import * as THREE from 'three';

/**
 * @type {number} _lastBCount - 재시작 시 사용할 이전 흑돌 개수 저장
 * @type {number} _lastWCount - 재시작 시 사용할 이전 백돌 개수 저장
 */
let _lastBCount = 10;
let _lastWCount = 10;

/**
 * @function init
 * @description
 * - 비동기 방식으로 게임의 모든 구성 요소 초기화 진행
 * - 부트스트래핑 순서: 엔진 -> 카메라 -> 에셋 -> 스킬 -> 환경 -> 날씨 -> 상호작용 -> UI -> 애니메이션 루프
 * @returns {Promise<void>}
 */
async function init() {
    await initEngine();
    initCameraManager(scene, renderer.domElement);
    await loadAssets();
    skillManager.initSkills();
    createEnvironment();
    initWeather(scene);
    initInteraction();

    initUI({
        /**
         * @callback onStart
         * - 시작 화면에서 "다음" 버튼 클릭 시 호출
         * - 입력된 돌 개수 유효성 검사 및 저장
         * - 포진 선택 화면 전환
         */
        onStart: () => {
            const inputBlack = document.getElementById('input-black');
            const inputWhite = document.getElementById('input-white');
            const bCount = Math.max(1, parseInt(inputBlack?.value) || 10);
            const wCount = Math.max(1, parseInt(inputWhite?.value) || 10);

            _lastBCount = bCount;
            _lastWCount = wCount;

            const startScreen = document.getElementById('start-screen');
            if (startScreen) startScreen.style.display = 'none';

            _bindFormationBackButton();
            showFormationScreen(bCount, wCount, startGame);
        },

        /**
         * @callback onRestart
         * - 게임 오버 화면에서 "다시하기" 클릭 시 호출
         * - 직전 게임의 돌 개수를 유지한 채 포진 선택 화면으로 복귀
         */
        onRestart: () => {
            const gameOverScreen = document.getElementById('game-over-screen');
            if (gameOverScreen) gameOverScreen.style.display = 'none';
            _bindFormationBackButton();
            showFormationScreen(_lastBCount, _lastWCount, startGame);
        },

        /**
         * @callback onToStart
         * - 게임 오버 화면에서 "시작 화면" 클릭 시 호출
         * - 게임 상태 초기화 및 첫 시작 메뉴로 복귀
         */
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

        /**
         * @callback onSkillSelect
         * - 인게임 UI에서 스킬 버튼 클릭 시 호출
         * - 조준(AIMING) 상태에서만 스킬 선택 허용
         * @param {string} skillId - 선택된 스킬의 고유 ID
         * @param {HTMLElement} target - 클릭된 UI 엘리먼트
         */
        onSkillSelect: (skillId, target) => {
            if (state.gameState !== "AIMING") return;
            document.querySelectorAll('.skill-opt').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            skillManager.setSkill(skillId);
        }
    });

    animate(0);
}

/**
 * @function _bindFormationBackButton
 * @description
 * - 포진 선택 화면의 "뒤로 가기" 버튼 이벤트 바인딩
 * - 포진 선택을 취소하고 시작 화면으로 복귀
 */
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
 * @function startGame
 * @description
 * - 실제 게임 플레이 화면으로 진입 및 상태 초기화
 * - 이전 스킬 사용 기록 초기화
 * - 바둑돌 생성 및 배치
 * - 카메라 시점 기본값 리셋
 * 
 * @param {number} bCount - 흑돌 개수
 * @param {number} wCount - 백돌 개수
 * @param {Array<{x:number, z:number}>} bPositions - 흑돌 좌표 배열
 * @param {Array<{x:number, z:number}>} wPositions - 백돌 좌표 배열
 */
function startGame(bCount, wCount, bPositions, wPositions) {
    _lastBCount = bCount;
    _lastWCount = wCount;

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
