/**
 * src/ui.js
 * Role: UI Management (DOM elements, Scoreboard, Overlays).
 * Functions:
 * - initUI(callbacks): Sets up DOM elements and event listeners.
 * - updateStatusUI(): Refreshes the score and turn indicator UI.
 * - resetSkillUI(): Resets the styling of skill selection buttons.
 * - showGameOver(winner): Displays the winner overlay.
 */
import { state } from './state.js';

export let rhythmUi, shrinkingRing, rhythmText;
export let turnIndicator, blackScore, whiteScore;
export let uiContainer, statusContainer;
export let startScreen, gameOverScreen, winnerText;
export let inputBlack, inputWhite;

export function initUI(callbacks) {
    const { onStart, onRestart, onToStart, onSkillSelect } = callbacks;

    rhythmUi = document.getElementById('rhythm-container');
    shrinkingRing = document.getElementById('shrinking-ring');
    rhythmText = document.getElementById('rhythm-text');
    
    turnIndicator = document.getElementById('turn-indicator');
    blackScore = document.getElementById('black-score');
    whiteScore = document.getElementById('white-score');
    
    uiContainer = document.getElementById('ui-container');
    statusContainer = document.getElementById('status-container');
    startScreen = document.getElementById('start-screen');
    gameOverScreen = document.getElementById('game-over-screen');
    winnerText = document.getElementById('winner-text');
    
    inputBlack = document.getElementById('input-black');
    inputWhite = document.getElementById('input-white');

    document.getElementById('btn-start').addEventListener('click', onStart);
    document.getElementById('btn-restart').addEventListener('click', onRestart);
    document.getElementById('btn-to-start').addEventListener('click', onToStart);

    document.querySelectorAll('.skill-opt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            onSkillSelect(e.target.dataset.skill, e.target);
        });
    });
}

export function updateStatusUI() {
    if (!turnIndicator) return;
    turnIndicator.innerText = `현재 차례: ${state.currentTurn === 'black' ? '흑(Black)' : '백(White)'}`;
    turnIndicator.style.color = state.currentTurn === 'black' ? '#aaaaaa' : '#ffffff';
    
    blackScore.innerText = `${state.currentBlack} / ${state.totalBlack}`;
    whiteScore.innerText = `${state.currentWhite} / ${state.totalWhite}`;
}

export function resetSkillUI() {
    document.querySelectorAll('.skill-opt').forEach(b => b.classList.remove('active'));
    const defaultOpt = document.querySelector('.skill-opt[data-skill="NONE"]');
    if (defaultOpt) defaultOpt.classList.add('active');
}

export function showGameOver(winner) {
    state.gameState = "GAMEOVER";
    winnerText.innerText = winner === 'black' ? "흑(Black) 승리! 🎉" : 
                          winner === 'white' ? "백(White) 승리! 🎉" : "무승부! 🤝";
    winnerText.style.color = winner === 'black' ? "#aaaaaa" : "#ffffff";
    
    setTimeout(() => {
        gameOverScreen.style.display = 'flex';
    }, 1000);
}
