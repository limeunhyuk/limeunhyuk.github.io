/**
 * @file ui.js
 * @description
 * - HTML DOM 요소들을 조작하여 게임 UI(메뉴, 점수판, 스킬 선택창 등)를 렌더링하고 관리
 * - 스킬 버튼의 동적 생성 및 사용 횟수 제한(1회 사용 시 비활성화) 처리
 * - 턴 전환 시 UI 색상 테마(흑/백) 변경 및 화면 렌더링 전환 제어
 */

import { state }        from './state.js';
import { skillManager } from './SkillManager.js';

// ── UI 요소 참조 변수들 ──
// 리듬 미니게임 관련
export let rhythmUi, shrinkingRing, rhythmText;
// 점수 및 상태 관련
export let turnIndicator, blackScore, whiteScore;
// 화면 덮개 및 컨테이너
export let uiContainer, statusContainer;
export let startScreen, gameOverScreen, winnerText;
// 초기 설정 입력창
export let inputBlack, inputWhite;

/**
 * @function initUI
 * @description
 * - DOM 요소를 찾아 참조 변수에 할당
 * - 버튼 클릭 이벤트(시작, 재시작, 메인으로) 리스너 등록
 * - 스킬 매니저에 등록된 스킬들을 바탕으로 스킬 선택 버튼을 동적으로 생성
 * @param {Object} callbacks - 각 버튼 클릭 시 호출될 콜백 함수 모음 (onStart, onRestart, onToStart, onSkillSelect)
 */
export function initUI(callbacks) {
    const { onStart, onRestart, onToStart, onSkillSelect } = callbacks;

    rhythmUi      = document.getElementById('rhythm-container');
    shrinkingRing = document.getElementById('shrinking-ring');
    rhythmText    = document.getElementById('rhythm-text');

    turnIndicator = document.getElementById('turn-indicator');
    blackScore    = document.getElementById('black-score');
    whiteScore    = document.getElementById('white-score');

    uiContainer   = document.getElementById('ui-container');
    statusContainer = document.getElementById('status-container');
    startScreen   = document.getElementById('start-screen');
    gameOverScreen = document.getElementById('game-over-screen');
    winnerText    = document.getElementById('winner-text');

    inputBlack = document.getElementById('input-black');
    inputWhite = document.getElementById('input-white');

    document.getElementById('btn-start')  .addEventListener('click', onStart);
    document.getElementById('btn-restart').addEventListener('click', onRestart);
    document.getElementById('btn-to-start').addEventListener('click', onToStart);

    generateSkillUI(onSkillSelect);
}

// ── 스킬 UI 생성 영역 ──

/**
 * @function generateSkillUI
 * @description
 * - skillManager에 등록된 스킬 데이터를 가져와 공격/방해 두 그룹으로 나누어 버튼 렌더링
 * - 'NONE' 스킬은 스킬 취소용 버튼으로 최상단에 별도 배치
 * @param {Function} onSkillSelect - 스킬 버튼 클릭 시 호출될 콜백
 */
function generateSkillUI(onSkillSelect) {
    const container = document.getElementById('skill-options');
    if (!container) return;
    container.innerHTML = '';

    const allSkills = skillManager.getRegisteredSkills();

    // 1. "취소 / 기본(NONE)" 버튼 최상단 배치
    const noneSkill = allSkills.find(s => s.id === 'NONE');
    if (noneSkill) {
        const cancelBtn = _makeSkillBtn(noneSkill, onSkillSelect);
        cancelBtn.classList.add('skill-cancel');
        cancelBtn.classList.add('active'); // 기본 상태는 항상 '취소'
        container.appendChild(cancelBtn);
    }

    // 2. 공격 스킬과 방해 스킬을 그룹핑하여 렌더링
    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'skill-groups-container';

    const groups = [
        { key: 'ATTACK',     label: '⚔️ 공격 스킬' },
        { key: 'DISRUPTION', label: '🌀 방해 스킬' }
    ];

    groups.forEach(({ key, label }) => {
        const skills = allSkills.filter(s => s.group === key);
        if (skills.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'skill-group';

        const labelEl = document.createElement('div');
        labelEl.className = 'skill-group-label';
        labelEl.textContent = label;
        groupDiv.appendChild(labelEl);

        const btnsDiv = document.createElement('div');
        btnsDiv.className = 'skill-group-btns';

        skills.forEach(skill => {
            btnsDiv.appendChild(_makeSkillBtn(skill, onSkillSelect));
        });

        groupDiv.appendChild(btnsDiv);
        groupWrapper.appendChild(groupDiv);
    });

    container.appendChild(groupWrapper);
}

/**
 * @function _makeSkillBtn
 * @description 단일 스킬 버튼 DOM 엘리먼트 생성 헬퍼 함수
 */
function _makeSkillBtn(skill, onSkillSelect) {
    const btn = document.createElement('button');
    btn.className = 'skill-opt';
    btn.dataset.skill = skill.id;
    btn.innerText = skill.name;
    btn.addEventListener('click', () => onSkillSelect(skill.id, btn));
    return btn;
}

// ── 스킬 사용 가능 여부 갱신 ──

/**
 * @function updateSkillAvailabilityUI
 * @description
 * - 플레이어가 스킬을 1번씩만 쓸 수 있도록, 이미 쓴 스킬 버튼에 'used' 클래스를 추가하고 비활성화(disabled)
 * - 상대가 직전 턴에 방해 스킬을 썼다면, 연속 방해를 막기 위해 방해 스킬 그룹을 1턴간 강제 비활성화
 */
export function updateSkillAvailabilityUI() {
    document.querySelectorAll('.skill-opt[data-skill]').forEach(btn => {
        const id = btn.dataset.skill;
        if (!id || id === 'NONE') return;

        const used = skillManager.isSkillUsed(id);

        // 방해 스킬 연속 사용 금지 룰 체크
        const skill = skillManager.skills.get(id);
        const disruptionBlocked = skill?.group === 'DISRUPTION' && state.disruptionUsedLastTurn;

        const disabled = used || disruptionBlocked;

        btn.classList.toggle('used', used);
        btn.classList.toggle('disruption-blocked', disruptionBlocked && !used);
        btn.disabled = disabled;

        // 비활성화된 스킬이 현재 활성 상태로 남아있다면 해제
        if (disabled && btn.classList.contains('active')) {
            btn.classList.remove('active');
        }
    });
}

// ── UI 턴 테마 변경 ──

/**
 * @function updateUITheme
 * @description
 * - 흑턴과 백턴에 따라 스킬 선택창, 조작 가이드 등 주요 UI 박스 테두리와 배경색 테마 변경
 * - CSS 클래스('turn-black', 'turn-white') 토글 방식으로 처리
 */
function updateUITheme() {
    const isBlack = state.currentTurn === 'black';
    const isWhite = state.currentTurn === 'white';

    const els = [
        document.getElementById('skill-selector'),
        document.getElementById('ui-container'),
        document.getElementById('status-container'),
        document.getElementById('camera-controls-guide')
    ];

    els.forEach(el => {
        if (!el) return;
        el.classList.toggle('turn-black', isBlack);
        el.classList.toggle('turn-white', isWhite);
    });
}

// ── 점수 및 상태 업데이트 ──

/**
 * @function updateStatusUI
 * @description
 * - 상단 점수판의 현재 턴, 남은 흑돌/백돌 개수를 텍스트로 반영
 * - UI 테마와 스킬 사용 가능 여부도 함께 갱신
 */
export function updateStatusUI() {
    if (!turnIndicator) return;
    turnIndicator.innerText = `현재 차례: ${state.currentTurn === 'black' ? '흑(Black)' : '백(White)'}`;
    turnIndicator.style.color = state.currentTurn === 'black' ? '#aaaaaa' : '#ffffff';

    blackScore.innerText = `${state.currentBlack} / ${state.totalBlack}`;
    whiteScore.innerText = `${state.currentWhite} / ${state.totalWhite}`;

    updateUITheme();
    updateSkillAvailabilityUI();
}

/**
 * @function resetSkillUI
 * @description
 * - 선택되어 있던 모든 스킬 버튼의 활성화 상태 해제 후, 기본값('NONE')으로 강제 선택
 * - 턴이 넘어갈 때 주로 호출됨
 */
export function resetSkillUI() {
    document.querySelectorAll('.skill-opt').forEach(b => b.classList.remove('active'));
    const def = document.querySelector('.skill-opt[data-skill="NONE"]');
    if (def) def.classList.add('active');

    updateUITheme();
    updateSkillAvailabilityUI();
}

// ── 게임 오버 화면 ──

/**
 * @function showGameOver
 * @description
 * - 턴이 종료되고 승패가 났을 때 호출됨
 * - 승자 텍스트를 업데이트하고 1초 뒤에 게임 오버 스크린을 화면에 띄움
 * @param {string} winner - 'black', 'white', 'draw'
 */
export function showGameOver(winner) {
    state.gameState = "GAMEOVER";
    winnerText.innerText =
        winner === 'black' ? "흑(Black) 승리! 🎉" :
        winner === 'white' ? "백(White) 승리! 🎉" : "무승부! 🤝";
    winnerText.style.color = winner === 'black' ? "#aaaaaa" : "#ffffff";

    setTimeout(() => { gameOverScreen.style.display = 'flex'; }, 1000);
}

// ── 전체 UI 가시성 토글 ──

/**
 * @function toggleGameUI
 * @description
 * - 게임 루프 중 연출(예: 이동 중, 스킬 컷신 중)이 발생할 때 방해가 되지 않도록 게임 UI 전체를 숨기거나 다시 켬
 * @param {boolean} visible - 보일지 여부
 */
export function toggleGameUI(visible) {
    const d = visible ? 'block' : 'none';
    if (uiContainer)     uiContainer.style.display = d;
    if (statusContainer) statusContainer.style.display = d;

    const skillSelector  = document.getElementById('skill-selector');
    if (skillSelector)   skillSelector.style.display = d;

    const camGuide = document.getElementById('camera-controls-guide');
    if (camGuide)        camGuide.style.display = d;

    if (visible) {
        updateUITheme();
        updateSkillAvailabilityUI();
    }
}
