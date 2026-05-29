/**
 * src/formation.js
 * Role: Stone formation presets, preview canvas rendering, custom formation editor UI.
 */

// ── 보드 안전 영역 상수 ─────────────────────────────────────────────────────
// 보드 물리 크기: 15×15 (±7.5). 돌 반경(0.4) 여유를 두어 안전 영역 설정.
const Z_MIN    = 1.0;   // 흑돌 최소 z (중앙선에서 여유)
const Z_MAX    = 7.0;   // 흑돌 최대 z (가장자리에서 0.5 여유)
const X_LIM    = 6.5;   // 최대 |x|
const BOARD_V  = 8.0;   // 캔버스 시각화용 좌표 범위

function clampPos({ x, z }) {
    return {
        x: Math.max(-X_LIM, Math.min(X_LIM, x)),
        z: Math.max(Z_MIN,  Math.min(Z_MAX, z)),
    };
}

// ── 포진 생성 함수들 ────────────────────────────────────────────────────────
// 흑돌 기준 좌표 { x, z } 배열 반환. 백돌은 mirrorPositions() 로 변환.

function genDefault(count) {
    const perRow = 5;
    const pos = [];
    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        pos.push(clampPos({
            x: -4 + col * 2.0 + (row % 2 ? 1.0 : 0.0),
            z: 6 - row,
        }));
    }
    return pos;
}

function genTriangle(count) {
    // 필요한 행 수 계산 (1+2+3+...+n ≥ count)
    let numRows = 0, total = 0;
    while (total < count) total += ++numRows;

    const pos = [];
    for (let row = 0; row < numRows && pos.length < count; row++) {
        const z = numRows > 1
            ? Z_MAX - row * (Z_MAX - Z_MIN) / (numRows - 1)
            : (Z_MAX + Z_MIN) / 2;
        const cols = row + 1;
        // 1.5 → 2.0 으로 가로 간격 확대
        const xStep = cols > 1 ? Math.min(2.0, (X_LIM * 2) / (cols - 1)) : 0;
        for (let c = 0; c < cols && pos.length < count; c++) {
            pos.push(clampPos({ x: (c - (cols - 1) / 2) * xStep, z }));
        }
    }
    return pos;
}

function genDiamond(count) {
    // 마름모: 중앙이 가장 넓고 위아래로 좁아지는 대칭 형태
    // 삼각형(아래로만 확장)과 달리 양쪽이 대칭으로 좁아짐
    const numRows = Math.max(3, Math.ceil(Math.sqrt(count)));

    // 각 행 가중치: 중앙 1.0, 양끝 0.4 → 마름모 윤곽
    const weights = Array.from({ length: numRows }, (_, r) => {
        const t = numRows > 1 ? r / (numRows - 1) : 0.5;
        return 1.0 - Math.abs(2 * t - 1.0) * 0.6; // 0.4 ~ 1.0
    });
    const totalW = weights.reduce((a, b) => a + b, 0);

    // count 비례 배분 (각 행 최소 1개)
    const rowCounts = weights.map(w => Math.max(1, Math.round(w * count / totalW)));

    // 총합 오차 보정 (중앙 행부터 조정)
    let diff = rowCounts.reduce((a, b) => a + b, 0) - count;
    const mid = Math.floor(numRows / 2);
    for (let i = 0; diff !== 0 && i < numRows * 3; i++) {
        const idx = (mid + i) % numRows;
        if (diff > 0 && rowCounts[idx] > 1) { rowCounts[idx]--; diff--; }
        else if (diff < 0)                  { rowCounts[idx]++; diff++; }
    }

    const pos = [];
    rowCounts.forEach((n, ri) => {
        const z = numRows > 1
            ? Z_MAX - ri * (Z_MAX - Z_MIN) / (numRows - 1)
            : (Z_MAX + Z_MIN) / 2;
        const xStep = n > 1 ? Math.min(2.0, (X_LIM * 2) / (n - 1)) : 0;
        for (let c = 0; c < n; c++) {
            pos.push(clampPos({ x: (c - (n - 1) / 2) * xStep, z }));
        }
    });
    return pos;
}

function genCompact(count) {
    const cols = Math.max(3, Math.ceil(Math.sqrt(count * 1.5)));
    const rows = Math.ceil(count / cols);
    // 중앙 쪽으로 당기기: 6.5 → 4.5 (앞으로 배치)
    const zTop = 4.5;
    const zBot = Z_MIN + 0.5;   // 1.5
    const pos = [];
    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const z = rows > 1 ? zTop - row * (zTop - zBot) / (rows - 1) : (zTop + zBot) / 2;
        pos.push(clampPos({ x: (col - (cols - 1) / 2) * 1.0, z }));
    }
    return pos;
}

function genSpread(count) {
    // 맵 전체에 흩뿌리기: 3~4행, 각 행은 x 전체 폭(-X_LIM ~ +X_LIM) 균등 사용
    const rows = count <= 6 ? 2 : count <= 15 ? 3 : 4;
    const pos  = [];

    for (let row = 0; row < rows; row++) {
        const z = rows > 1
            ? Z_MAX - row * (Z_MAX - Z_MIN) / (rows - 1)
            : (Z_MAX + Z_MIN) / 2;

        // 각 행에 균등 분배
        const iStart = Math.round(row       * count / rows);
        const iEnd   = Math.round((row + 1) * count / rows);
        const n      = iEnd - iStart;
        if (n === 0) continue;

        // 전체 x 폭을 꽉 채워서 배치
        const xStep = n > 1 ? (X_LIM * 2) / (n - 1) : 0;
        for (let col = 0; col < n; col++) {
            pos.push(clampPos({ x: n > 1 ? -X_LIM + col * xStep : 0, z }));
        }
    }
    return pos;
}

// ── 포진 목록 ───────────────────────────────────────────────────────────────
export const FORMATIONS = [
    { id: 'DEFAULT',  name: '기본형',  desc: '5열 기본 배치',    fn: genDefault  },
    { id: 'TRIANGLE', name: '삼각형',  desc: '뾰족한 삼각 대형', fn: genTriangle },
    { id: 'DIAMOND',  name: '마름모',  desc: '다이아몬드 대형',  fn: genDiamond  },
    { id: 'COMPACT',  name: '집중형',  desc: '촘촘히 뭉친 배치', fn: genCompact  },
    { id: 'SPREAD',   name: '산개형',  desc: '넓게 퍼진 배치',   fn: genSpread   },
    { id: 'CUSTOM',   name: '커스텀',  desc: '직접 배치하기',    fn: null        },
];

export function getFormationPositions(id, count) {
    const f = FORMATIONS.find(f => f.id === id);
    return (f && f.fn) ? f.fn(count) : genDefault(count);
}

/** 흑돌 좌표 → 백돌 좌표 (z 반전) */
export function mirrorPositions(positions) {
    return positions.map(p => ({ x: p.x, z: -p.z }));
}

// ── 좌표 변환 헬퍼 ─────────────────────────────────────────────────────────
function worldToCanvas(wx, wz, size) {
    return {
        cx: ((wx + BOARD_V) / (BOARD_V * 2)) * size,
        cy: ((wz + BOARD_V) / (BOARD_V * 2)) * size,
    };
}

// ── 미리보기 캔버스 렌더링 ──────────────────────────────────────────────────
export function drawPreview(canvas, bPos, wPos) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#2a1500';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,200,100,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(W * i / 5, 0); ctx.lineTo(W * i / 5, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, H * i / 5); ctx.lineTo(W, H * i / 5); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,200,100,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,200,100,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.46, 0, Math.PI * 2); ctx.stroke();

    const r = Math.max(2.5, W / 26);
    const draw = (arr, fill, stroke) => arr.forEach(p => {
        const { cx, cy } = worldToCanvas(p.x, p.z, W);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke();
    });
    draw(bPos, '#1a1a1a', '#666');
    draw(wPos, '#eeeeee', '#aaa');
}

// ── 커스텀 포진 상태 ────────────────────────────────────────────────────────
export const customFormation = { black: [], white: [] };

let _customCanvas   = null;
let _placingTeam    = 'black';
let _customBCount   = 10;
let _customWCount   = 10;
let _onCustomChange = null;

/** 지정 팀을 위한 커스텀 에디터 열기 (기존 포지션 유지) */
function _openCustomEditorForTeam(team, onChange) {
    const canvas = document.getElementById('custom-canvas');
    if (!canvas) return;

    // 기존 이벤트 리스너 제거 (캔버스 교체)
    const fresh = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(fresh, canvas);
    _customCanvas = fresh;

    _placingTeam    = team;
    _onCustomChange = onChange;

    _customCanvas.addEventListener('click',       _onCustomClick);
    _customCanvas.addEventListener('contextmenu', _onCustomRightClick);

    // 레이블 업데이트
    const label = document.getElementById('custom-editor-label');
    if (label) {
        label.textContent = team === 'black' ? '⚫ 흑팀 배치 중' : '⚪ 백팀 배치 중';
        label.style.color = team === 'black' ? '#7aabff' : '#ffffff';
    }

    _redrawCustomEditor();
}

function _getCanvasPos(e) {
    const rect = _customCanvas.getBoundingClientRect();
    return {
        px: (e.clientX - rect.left) * (_customCanvas.width  / rect.width),
        py: (e.clientY - rect.top)  * (_customCanvas.height / rect.height),
    };
}

function _canvasToWorld(px, py) {
    const W = _customCanvas.width, H = _customCanvas.height;
    return {
        wx: Math.round(((px / W) * (BOARD_V * 2) - BOARD_V) * 2) / 2,
        wz: Math.round(((py / H) * (BOARD_V * 2) - BOARD_V) * 2) / 2,
    };
}

function _onCustomClick(e) {
    e.preventDefault();
    const { px, py } = _getCanvasPos(e);
    const { wx, wz } = _canvasToWorld(px, py);

    // 팀별 영역 제한 (흑: z>0, 백: z<0)
    if (_placingTeam === 'black' && wz <= 0.5) return;
    if (_placingTeam === 'white' && wz >= -0.5) return;

    // 보드 범위 내부
    if (Math.abs(wx) > X_LIM || Math.abs(wz) > BOARD_V * 0.9) return;

    // 개수 제한
    const maxCount = _placingTeam === 'black' ? _customBCount : _customWCount;
    if (customFormation[_placingTeam].length >= maxCount) return;

    // 겹침 방지
    const allPos = [...customFormation.black, ...customFormation.white];
    if (allPos.some(p => Math.hypot(p.x - wx, p.z - wz) < 0.9)) return;

    customFormation[_placingTeam].push({ x: wx, z: wz });
    _redrawCustomEditor();
    if (_onCustomChange) _onCustomChange();
}

function _onCustomRightClick(e) {
    e.preventDefault();
    const { px, py } = _getCanvasPos(e);
    const { wx, wz } = _canvasToWorld(px, py);
    // 우클릭: 현재 팀 돌만 제거
    customFormation[_placingTeam] = customFormation[_placingTeam].filter(
        p => Math.hypot(p.x - wx, p.z - wz) > 1.0
    );
    _redrawCustomEditor();
    if (_onCustomChange) _onCustomChange();
}

function _redrawCustomEditor() {
    if (!_customCanvas) return;
    const ctx = _customCanvas.getContext('2d');
    const W = _customCanvas.width, H = _customCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // 배경
    ctx.fillStyle = '#1a0d00';
    ctx.fillRect(0, 0, W, H);

    // 비활성 영역 어둡게
    const blackZoneY = ((0.5 + BOARD_V) / (BOARD_V * 2)) * H;
    const whiteZoneY = ((-0.5 + BOARD_V) / (BOARD_V * 2)) * H;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    if (_placingTeam === 'black') {
        ctx.fillRect(0, 0, W, whiteZoneY); // 백팀 영역 어둠
    } else {
        ctx.fillRect(0, blackZoneY, W, H - blackZoneY); // 흑팀 영역 어둠
    }

    // 활성 팀 영역 강조
    const topY  = _placingTeam === 'black' ? blackZoneY : 0;
    const botY  = _placingTeam === 'black' ? H : whiteZoneY;
    ctx.fillStyle = _placingTeam === 'black'
        ? 'rgba(60,100,220,0.14)'
        : 'rgba(220,220,255,0.09)';
    ctx.fillRect(0, topY, W, botY - topY);

    // 그리드
    ctx.strokeStyle = 'rgba(255,200,100,0.18)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(W * i / 8, 0); ctx.lineTo(W * i / 8, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, H * i / 8); ctx.lineTo(W, H * i / 8); ctx.stroke();
    }

    // 중앙 구분선
    ctx.strokeStyle = 'rgba(255,200,100,0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);

    // 보드 경계
    ctx.strokeStyle = 'rgba(255,200,100,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.45, 0, Math.PI * 2); ctx.stroke();

    // 영역 레이블
    ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    const wA = _placingTeam === 'white' ? 0.85 : 0.35;
    const bA = _placingTeam === 'black' ? 0.85 : 0.35;
    ctx.fillStyle = `rgba(200,220,255,${wA})`;
    ctx.fillText('백(White) 영역', W / 2, 15);
    ctx.fillStyle = `rgba(120,160,255,${bA})`;
    ctx.fillText('흑(Black) 영역', W / 2, H - 5);

    const r = Math.max(4, W / 24);

    // 흑돌 (비활성이면 반투명)
    ctx.globalAlpha = _placingTeam === 'black' ? 1.0 : 0.3;
    customFormation.black.forEach(p => {
        const { cx, cy } = worldToCanvas(p.x, p.z, W);
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#555'); g.addColorStop(1, '#111');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#777'; ctx.lineWidth = 1; ctx.stroke();
    });

    // 백돌 (비활성이면 반투명)
    ctx.globalAlpha = _placingTeam === 'white' ? 1.0 : 0.3;
    customFormation.white.forEach(p => {
        const { cx, cy } = worldToCanvas(p.x, p.z, W);
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#ccc');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1; ctx.stroke();
    });

    ctx.globalAlpha = 1.0;
}

// ── 포진 선택 화면 UI ──────────────────────────────────────────────────────

let _selectedBlackId = 'DEFAULT';
let _selectedWhiteId = 'DEFAULT';
let _activeTeam      = 'black';   // 현재 편집 중인 팀 탭
let _bCount          = 10;
let _wCount          = 10;
let _confirmCallback = null;

/** 포진 선택 화면을 열고 초기화합니다. */
export function showFormationScreen(bCount, wCount, onConfirm) {
    _bCount          = bCount;
    _wCount          = wCount;
    _selectedBlackId = 'DEFAULT';
    _selectedWhiteId = 'DEFAULT';
    _activeTeam      = 'black';
    _confirmCallback = onConfirm;
    _customBCount    = bCount;
    _customWCount    = wCount;

    // 커스텀 포진 초기화
    customFormation.black = [];
    customFormation.white = [];

    const screen = document.getElementById('formation-screen');
    if (screen) screen.style.display = 'flex';

    const editor = document.getElementById('custom-editor');
    if (editor) editor.style.display = 'none';

    _buildTeamTabs();
    _buildFormationCards();
    _setupButtons();
    _updateConfirmButton();
}

function _buildTeamTabs() {
    // 기존 탭 제거
    document.getElementById('formation-team-tabs')?.remove();

    const grid = document.getElementById('formation-grid');
    if (!grid) return;

    const tabRow = document.createElement('div');
    tabRow.id = 'formation-team-tabs';
    tabRow.className = 'formation-team-tabs';
    tabRow.innerHTML = `
        <button id="tab-formation-black" class="formation-team-tab active">
            <span class="tab-stone">●</span>
            <span class="tab-team-name">흑팀 포진</span>
            <span class="tab-badge black-badge" id="badge-black">기본형</span>
        </button>
        <button id="tab-formation-white" class="formation-team-tab">
            <span class="tab-stone white-s">○</span>
            <span class="tab-team-name">백팀 포진</span>
            <span class="tab-badge white-badge" id="badge-white">기본형</span>
        </button>
    `;
    grid.parentNode.insertBefore(tabRow, grid);

    document.getElementById('tab-formation-black').onclick = () => _switchTeamTab('black');
    document.getElementById('tab-formation-white').onclick = () => _switchTeamTab('white');
}

function _switchTeamTab(team) {
    _activeTeam = team;

    // 탭 스타일
    document.getElementById('tab-formation-black')?.classList.toggle('active', team === 'black');
    document.getElementById('tab-formation-white')?.classList.toggle('active', team === 'white');

    // 해당 팀의 선택으로 카드 하이라이트 갱신
    const selectedId = team === 'black' ? _selectedBlackId : _selectedWhiteId;
    document.querySelectorAll('.formation-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.id === selectedId)
    );

    // 커스텀 에디터 표시
    const editor = document.getElementById('custom-editor');
    if (!editor) return;
    if (selectedId === 'CUSTOM') {
        editor.style.display = 'flex';
        _openCustomEditorForTeam(team, () => _updateConfirmButton());
    } else {
        editor.style.display = 'none';
    }

    _updateConfirmButton();
}

function _buildFormationCards() {
    const grid = document.getElementById('formation-grid');
    if (!grid) return;
    grid.innerHTML = '';

    FORMATIONS.forEach(f => {
        const card = document.createElement('div');
        // 첫 빌드: 흑팀(기본 활성)의 선택으로 하이라이트
        card.className = 'formation-card' + (f.id === _selectedBlackId ? ' selected' : '');
        card.dataset.id = f.id;

        if (f.fn) {
            const canvas = document.createElement('canvas');
            canvas.className = 'preview-canvas';
            canvas.width = 110; canvas.height = 110;
            drawPreview(canvas, f.fn(_bCount), mirrorPositions(f.fn(_wCount)));
            card.appendChild(canvas);
        } else {
            const icon = document.createElement('div');
            icon.className = 'formation-custom-icon';
            icon.innerHTML = `<span class="formation-custom-pen">✏️</span>`;
            card.appendChild(icon);
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'formation-card-name';
        nameEl.textContent = f.name;
        card.appendChild(nameEl);

        const descEl = document.createElement('div');
        descEl.className = 'formation-card-desc';
        descEl.textContent = f.desc;
        card.appendChild(descEl);

        card.addEventListener('click', () => _selectFormation(f.id));
        grid.appendChild(card);
    });
}

function _selectFormation(id) {
    // 활성 팀의 포진 설정
    if (_activeTeam === 'black') _selectedBlackId = id;
    else                         _selectedWhiteId = id;

    // 카드 하이라이트
    document.querySelectorAll('.formation-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.id === id)
    );

    // 탭 배지 업데이트
    const badge = document.getElementById(`badge-${_activeTeam}`);
    if (badge) badge.textContent = FORMATIONS.find(f => f.id === id)?.name ?? id;

    // 커스텀 에디터 표시
    const editor = document.getElementById('custom-editor');
    if (!editor) return;
    if (id === 'CUSTOM') {
        editor.style.display = 'flex';
        _openCustomEditorForTeam(_activeTeam, () => _updateConfirmButton());
    } else {
        editor.style.display = 'none';
    }

    _updateConfirmButton();
}

function _setupButtons() {
    const btnConfirm = document.getElementById('btn-confirm-formation');
    if (btnConfirm) btnConfirm.onclick = _handleConfirm;

    // 커스텀 에디터 초기화 버튼 — 현재 활성 팀의 포지션만 초기화
    const btnClear = document.getElementById('btn-clear-custom');
    if (btnClear) btnClear.onclick = () => {
        customFormation[_activeTeam] = [];
        _redrawCustomEditor();
        _updateConfirmButton();
    };
}

function _updateConfirmButton() {
    const btn  = document.getElementById('btn-confirm-formation');
    const info = document.getElementById('custom-count-info');
    if (!btn) return;

    const blackOk = _selectedBlackId !== 'CUSTOM' || customFormation.black.length === _bCount;
    const whiteOk = _selectedWhiteId !== 'CUSTOM' || customFormation.white.length === _wCount;

    btn.disabled = !(blackOk && whiteOk);

    if (!blackOk || !whiteOk) {
        const parts = [];
        if (!blackOk) parts.push(`흑: ${customFormation.black.length}/${_bCount}`);
        if (!whiteOk) parts.push(`백: ${customFormation.white.length}/${_wCount}`);
        btn.textContent = `배치 필요 (${parts.join(', ')})`;
    } else {
        btn.textContent = '게임 시작! ▶';
    }

    if (info) {
        const anyCustom = _selectedBlackId === 'CUSTOM' || _selectedWhiteId === 'CUSTOM';
        if (anyCustom) {
            const parts = [];
            if (_selectedBlackId === 'CUSTOM')
                parts.push(`<span class="cinfo-black">● 흑: ${customFormation.black.length}/${_bCount}</span>`);
            if (_selectedWhiteId === 'CUSTOM')
                parts.push(`<span class="cinfo-white">○ 백: ${customFormation.white.length}/${_wCount}</span>`);
            info.innerHTML = parts.join('<span class="cinfo-sep"> | </span>') +
                '<span class="cinfo-hint">  ·  클릭: 배치  우클릭: 제거</span>';
        } else {
            info.textContent = '';
        }
    }
}

function _handleConfirm() {
    if (!_confirmCallback) return;

    const bPositions = _selectedBlackId === 'CUSTOM'
        ? [...customFormation.black]
        : getFormationPositions(_selectedBlackId, _bCount);

    const wPositions = _selectedWhiteId === 'CUSTOM'
        ? [...customFormation.white]
        : mirrorPositions(getFormationPositions(_selectedWhiteId, _wCount));

    document.getElementById('formation-screen').style.display = 'none';
    _confirmCallback(_bCount, _wCount, bPositions, wPositions);
}
