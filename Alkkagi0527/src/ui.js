/**
 * src/ui.js
 * Role: UI Management (DOM elements, Scoreboard, Overlays, Skill Selector).
 */
import { state }        from './state.js';
import { skillManager } from './SkillManager.js';

export let rhythmUi, shrinkingRing, rhythmText;
export let turnIndicator, blackScore, whiteScore;
export let uiContainer, statusContainer;
export let startScreen, gameOverScreen, winnerText;
export let inputBlack, inputWhite;

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

// ── Skill UI generation ───────────────────────────────────────────

/**
 * 스킬 버튼을 공격/방해 두 그룹으로 생성.
 * NONE 스킬은 "취소" 버튼으로 상단에 별도 표시.
 */
function generateSkillUI(onSkillSelect) {
    const container = document.getElementById('skill-options');
    if (!container) return;
    container.innerHTML = '';

    const allSkills = skillManager.getRegisteredSkills();

    // ── "취소 / 기본" 버튼 ──────────────────────────────────────
    const noneSkill = allSkills.find(s => s.id === 'NONE');
    if (noneSkill) {
        const cancelBtn = _makeSkillBtn(noneSkill, onSkillSelect);
        cancelBtn.classList.add('skill-cancel');
        cancelBtn.classList.add('active');
        container.appendChild(cancelBtn);
    }

    // ── 두 그룹 ──────────────────────────────────────────────────
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

function _makeSkillBtn(skill, onSkillSelect) {
    const btn = document.createElement('button');
    btn.className = 'skill-opt';
    btn.dataset.skill = skill.id;
    btn.innerText = skill.name;
    btn.addEventListener('click', () => onSkillSelect(skill.id, btn));
    return btn;
}

// ── Skill availability (once-per-game per player) ────────────────

/**
 * 현재 턴 플레이어의 이미 사용한 스킬을 비활성화한다.
 * resetSkillUI(), toggleGameUI(true) 에서 호출.
 */
export function updateSkillAvailabilityUI() {
    document.querySelectorAll('.skill-opt[data-skill]').forEach(btn => {
        const id = btn.dataset.skill;
        if (!id || id === 'NONE') return;

        const used = skillManager.isSkillUsed(id);

        // 상대방이 방해 스킬을 사용한 직후 1턴은 방해 스킬 비활성화
        const skill = skillManager.skills.get(id);
        const disruptionBlocked = skill?.group === 'DISRUPTION' && state.disruptionUsedLastTurn;

        const disabled = used || disruptionBlocked;

        btn.classList.toggle('used', used);
        btn.classList.toggle('disruption-blocked', disruptionBlocked && !used);
        btn.disabled = disabled;

        if (disabled && btn.classList.contains('active')) {
            btn.classList.remove('active');
        }
    });
}

// ── Skill Selector Turn Theme ────────────────────────────────────

/**
 * #skill-selector 의 테마 클래스를 현재 턴(흑/백)에 맞게 갱신한다.
 * updateStatusUI(), resetSkillUI() 에서 호출.
 */
function updateSkillSelectorTheme() {
    const sel = document.getElementById('skill-selector');
    if (!sel) return;
    sel.classList.toggle('turn-black', state.currentTurn === 'black');
    sel.classList.toggle('turn-white', state.currentTurn === 'white');
}

// ── Status & Score ────────────────────────────────────────────────

export function updateStatusUI() {
    if (!turnIndicator) return;
    turnIndicator.innerText =
        `현재 차례: ${state.currentTurn === 'black' ? '흑(Black)' : '백(White)'}`;
    turnIndicator.style.color = state.currentTurn === 'black' ? '#aaaaaa' : '#ffffff';

    blackScore.innerText = `${state.currentBlack} / ${state.totalBlack}`;
    whiteScore.innerText = `${state.currentWhite} / ${state.totalWhite}`;

    // 스킬 선택창 색상 테마 + 사용 가능 여부 갱신
    updateSkillSelectorTheme();
    updateSkillAvailabilityUI();
}

export function resetSkillUI() {
    document.querySelectorAll('.skill-opt').forEach(b => b.classList.remove('active'));
    const def = document.querySelector('.skill-opt[data-skill="NONE"]');
    if (def) def.classList.add('active');

    // 테마 + 사용 가능 여부 갱신 (턴이 바뀐 후 호출)
    updateSkillSelectorTheme();
    updateSkillAvailabilityUI();
}

// ── Game Over ─────────────────────────────────────────────────────

export function showGameOver(winner) {
    state.gameState = "GAMEOVER";
    winnerText.innerText =
        winner === 'black' ? "흑(Black) 승리! 🎉" :
        winner === 'white' ? "백(White) 승리! 🎉" : "무승부! 🤝";
    winnerText.style.color = winner === 'black' ? "#aaaaaa" : "#ffffff";

    setTimeout(() => { gameOverScreen.style.display = 'flex'; }, 1000);
}

export function checkRhythmTiming() {
    import('./skills/RhythmSkill.js').then(m => m.RhythmSkill.checkRhythmTiming());
}

// ── UI Visibility ─────────────────────────────────────────────────

export function toggleGameUI(visible) {
    const d = visible ? 'block' : 'none';
    if (uiContainer)     uiContainer.style.display = d;
    if (statusContainer) statusContainer.style.display = d;

    const skillSelector  = document.getElementById('skill-selector');
    if (skillSelector)   skillSelector.style.display = d;

    const camGuide = document.getElementById('camera-controls-guide');
    if (camGuide)        camGuide.style.display = d;

    // UI가 표시될 때 테마 + 스킬 가용 여부 갱신
    if (visible) {
        updateSkillSelectorTheme();
        updateSkillAvailabilityUI();
    }
}
