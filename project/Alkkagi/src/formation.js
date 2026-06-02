/**
 * @file formation.js
 * @description
 * - 시작 전 바둑돌들의 배치(포진) 방식을 계산하고 렌더링하는 역할 수행
 * - 기본 제공 포진(기본형, 삼각형, 마름모 등) 생성 함수 제공
 * - 2D Canvas를 이용한 포진 미리보기 UI 및 직접 그릴 수 있는 커스텀 에디터 구현
 */

// ── 보드 안전 영역 상수 ──
// 물리적 보드 크기: 15×15 (반경 ±7.5)
// 바둑돌 반경(0.4)과 충돌을 고려하여 가장자리 여백 확보
/** @type {number} Z_MIN - 흑돌 최소 z 좌표 (중앙선에서 떨어지는 여유) */
const Z_MIN    = 1.0;   
/** @type {number} Z_MAX - 흑돌 최대 z 좌표 (보드 가장자리 앞) */
const Z_MAX    = 7.0;   
/** @type {number} X_LIM - x 좌표 좌우 한계선 */
const X_LIM    = 6.5;   
/** @type {number} BOARD_V - 2D 캔버스에 렌더링하기 위한 가상 좌표계 크기 (±8.0) */
const BOARD_V  = 8.0;   

/**
 * @function clampPos
 * @description 생성된 좌표가 안전 영역(X_LIM, Z_MIN, Z_MAX)을 벗어나지 않도록 강제 제한
 */
function clampPos({ x, z }) {
    return {
        x: Math.max(-X_LIM, Math.min(X_LIM, x)),
        z: Math.max(Z_MIN,  Math.min(Z_MAX, z)),
    };
}

// ── 포진(Formation) 생성 함수들 ──
// 기본적으로 흑돌(Black) 기준의 좌표(+z)를 계산하여 반환
// 백돌(White)은 생성 후 mirrorPositions()를 통해 z값을 반전시켜 적용함

/**
 * @function genDefault
 * @description 5열 횡대 기본 배치 (앞뒤로 번갈아 지그재그 배치)
 */
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

/**
 * @function genTriangle
 * @description 맨 앞이 1개이고 뒤로 갈수록 개수가 늘어나는 쐐기/삼각형 배치
 */
function genTriangle(count) {
    let numRows = 0, total = 0;
    while (total < count) total += ++numRows; // 필요한 총 행 수 계산

    const pos = [];
    for (let row = 0; row < numRows && pos.length < count; row++) {
        // 맨 뒤가 Z_MAX, 맨 앞이 Z_MIN에 가깝도록 분배
        const z = numRows > 1
            ? Z_MAX - row * (Z_MAX - Z_MIN) / (numRows - 1)
            : (Z_MAX + Z_MIN) / 2;
        const cols = row + 1;
        const xStep = cols > 1 ? Math.min(2.0, (X_LIM * 2) / (cols - 1)) : 0;
        
        for (let c = 0; c < cols && pos.length < count; c++) {
            // 중앙(0)을 기준으로 좌우 대칭 배치
            pos.push(clampPos({ x: (c - (cols - 1) / 2) * xStep, z }));
        }
    }
    return pos;
}

/**
 * @function genDiamond
 * @description 가운데가 넓고 위아래가 좁은 다이아몬드형 배치
 */
function genDiamond(count) {
    const numRows = Math.max(3, Math.ceil(Math.sqrt(count)));

    // 중앙 행일수록 가중치를 높게 주어(1.0) 더 많은 돌이 들어가게 설계
    const weights = Array.from({ length: numRows }, (_, r) => {
        const t = numRows > 1 ? r / (numRows - 1) : 0.5;
        return 1.0 - Math.abs(2 * t - 1.0) * 0.6;
    });
    const totalW = weights.reduce((a, b) => a + b, 0);

    // 총 개수(count)에 맞게 각 행별 돌 개수 분배
    const rowCounts = weights.map(w => Math.max(1, Math.round(w * count / totalW)));

    // 분배 오차 보정 (중앙 행 우선 추가/제거)
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

/**
 * @function genCompact
 * @description 모든 돌이 좁은 영역에 촘촘하게 뭉쳐 있는 방어적 대형
 */
function genCompact(count) {
    const cols = Math.max(3, Math.ceil(Math.sqrt(count * 1.5)));
    const rows = Math.ceil(count / cols);
    // 중앙선에 가깝게 전진 배치
    const zTop = 4.5;
    const zBot = Z_MIN + 0.5;
    const pos = [];
    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const z = rows > 1 ? zTop - row * (zTop - zBot) / (rows - 1) : (zTop + zBot) / 2;
        pos.push(clampPos({ x: (col - (cols - 1) / 2) * 1.0, z }));
    }
    return pos;
}

/**
 * @function genSpread
 * @description 맵 끝에서 끝까지 가로로 쫙 펴져 있는 산개 대형
 */
function genSpread(count) {
    const rows = count <= 6 ? 2 : count <= 15 ? 3 : 4;
    const pos  = [];

    for (let row = 0; row < rows; row++) {
        const z = rows > 1
            ? Z_MAX - row * (Z_MAX - Z_MIN) / (rows - 1)
            : (Z_MAX + Z_MIN) / 2;

        const iStart = Math.round(row       * count / rows);
        const iEnd   = Math.round((row + 1) * count / rows);
        const n      = iEnd - iStart;
        if (n === 0) continue;

        const xStep = n > 1 ? (X_LIM * 2) / (n - 1) : 0;
        for (let col = 0; col < n; col++) {
            pos.push(clampPos({ x: n > 1 ? -X_LIM + col * xStep : 0, z }));
        }
    }
    return pos;
}

// ── 포진 메타데이터 및 변환 유틸리티 ──

/** @type {Array<Object>} FORMATIONS - UI에 표시할 포진 프리셋 목록 및 함수 매핑 */
export const FORMATIONS = [
    { id: 'DEFAULT',  name: '기본형',  desc: '5열 기본 배치',    fn: genDefault  },
    { id: 'TRIANGLE', name: '삼각형',  desc: '뾰족한 삼각 대형', fn: genTriangle },
    { id: 'DIAMOND',  name: '마름모',  desc: '다이아몬드 대형',  fn: genDiamond  },
    { id: 'COMPACT',  name: '집중형',  desc: '촘촘히 뭉친 배치', fn: genCompact  },
    { id: 'SPREAD',   name: '산개형',  desc: '넓게 퍼진 배치',   fn: genSpread   },
    { id: 'CUSTOM',   name: '커스텀',  desc: '직접 배치하기',    fn: null        },
];

/** ID와 돌 개수를 받아 좌표 배열을 반환 */
export function getFormationPositions(id, count) {
    const f = FORMATIONS.find(f => f.id === id);
    return (f && f.fn) ? f.fn(count) : genDefault(count);
}

/** 흑돌 좌표를 백돌 진영으로 복사 (z축 반전) */
export function mirrorPositions(positions) {
    return positions.map(p => ({ x: p.x, z: -p.z }));
}

// ── 2D 캔버스 렌더링 로직 (미리보기 및 에디터) ──

/** 3D 월드 좌표(x, z)를 2D 캔버스 픽셀 좌표(cx, cy)로 변환 */
function worldToCanvas(wx, wz, size) {
    return {
        cx: ((wx + BOARD_V) / (BOARD_V * 2)) * size,
        cy: ((wz + BOARD_V) / (BOARD_V * 2)) * size,
    };
}

/**
 * @function drawPreview
 * @description 포진 선택 카드 UI에 들어갈 썸네일(미니맵) 캔버스를 그림
 */
export function drawPreview(canvas, bPos, wPos) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#2a1500';
    ctx.fillRect(0, 0, W, H);

    // 격자 그리기
    ctx.strokeStyle = 'rgba(255,200,100,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(W * i / 5, 0); ctx.lineTo(W * i / 5, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, H * i / 5); ctx.lineTo(W, H * i / 5); ctx.stroke();
    }
    
    // 중앙선과 원(바둑판 윤곽) 그리기
    ctx.strokeStyle = 'rgba(255,200,100,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,200,100,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.46, 0, Math.PI * 2); ctx.stroke();

    // 바둑돌 점 찍기
    const r = Math.max(2.5, W / 26);
    const draw = (arr, fill, stroke) => arr.forEach(p => {
        const { cx, cy } = worldToCanvas(p.x, p.z, W);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke();
    });
    draw(bPos, '#1a1a1a', '#666'); // 흑
    draw(wPos, '#eeeeee', '#aaa'); // 백
}

// ── 커스텀 포진 에디터 관련 로직 ──

export const customFormation = { black: [], white: [] };
let _customCanvas   = null;
let _placingTeam    = 'black';
let _customBCount   = 10;
let _customWCount   = 10;
let _onCustomChange = null;

/** 
 * @function _openCustomEditorForTeam
 * @description '커스텀' 선택 시 해당 팀의 돌을 마우스로 찍어서 배치할 수 있는 대형 캔버스 모드 활성화 
 */
function _openCustomEditorForTeam(team, onChange) {
    const canvas = document.getElementById('custom-canvas');
    if (!canvas) return;

    // 이벤트 중복을 막기 위해 캔버스 노드를 교체하여 기존 리스너 삭제
    const fresh = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(fresh, canvas);
    _customCanvas = fresh;

    _placingTeam    = team;
    _onCustomChange = onChange;

    _customCanvas.addEventListener('click',       _onCustomClick); // 돌 추가
    _customCanvas.addEventListener('contextmenu', _onCustomRightClick); // 우클릭 시 돌 제거

    const label = document.getElementById('custom-editor-label');
    if (label) {
        label.textContent = team === 'black' ? '⚫ 흑팀 배치 중' : '⚪ 백팀 배치 중';
        label.style.color = team === 'black' ? '#7aabff' : '#ffffff';
    }

    _redrawCustomEditor();
}

/** 이벤트 발생 픽셀 좌표 추출 */
function _getCanvasPos(e) {
    const rect = _customCanvas.getBoundingClientRect();
    return {
        px: (e.clientX - rect.left) * (_customCanvas.width  / rect.width),
        py: (e.clientY - rect.top)  * (_customCanvas.height / rect.height),
    };
}

/** 캔버스 픽셀을 3D 월드 좌표(x, z)로 매핑 (0.5 단위로 스냅 적용) */
function _canvasToWorld(px, py) {
    const W = _customCanvas.width, H = _customCanvas.height;
    return {
        wx: Math.round(((px / W) * (BOARD_V * 2) - BOARD_V) * 2) / 2,
        wz: Math.round(((py / H) * (BOARD_V * 2) - BOARD_V) * 2) / 2,
    };
}

/** 마우스 좌클릭 시 돌 생성 */
function _onCustomClick(e) {
    e.preventDefault();
    const { px, py } = _getCanvasPos(e);
    const { wx, wz } = _canvasToWorld(px, py);

    // 상대방 진영에는 설치 불가 (흑은 아래, 백은 위 절반만 사용)
    if (_placingTeam === 'black' && wz <= 0.5) return;
    if (_placingTeam === 'white' && wz >= -0.5) return;

    // 보드 밖 설치 불가
    if (Math.abs(wx) > X_LIM || Math.abs(wz) > BOARD_V * 0.9) return;

    // 설정된 게임 돌 개수(최대치) 제한
    const maxCount = _placingTeam === 'black' ? _customBCount : _customWCount;
    if (customFormation[_placingTeam].length >= maxCount) return;

    // 기존에 놓인 돌과 겹침(충돌) 검사 (반경 고려)
    const allPos = [...customFormation.black, ...customFormation.white];
    if (allPos.some(p => Math.hypot(p.x - wx, p.z - wz) < 0.9)) return;

    customFormation[_placingTeam].push({ x: wx, z: wz });
    _redrawCustomEditor();
    if (_onCustomChange) _onCustomChange();
}

/** 마우스 우클릭 시 클릭된 위치 주변의 돌 제거 */
function _onCustomRightClick(e) {
    e.preventDefault();
    const { px, py } = _getCanvasPos(e);
    const { wx, wz } = _canvasToWorld(px, py);
    customFormation[_placingTeam] = customFormation[_placingTeam].filter(
        p => Math.hypot(p.x - wx, p.z - wz) > 1.0
    );
    _redrawCustomEditor();
    if (_onCustomChange) _onCustomChange();
}

/** 커스텀 에디터 캔버스를 지우고 현재 상태에 맞게 다시 렌더링 */
function _redrawCustomEditor() {
    if (!_customCanvas) return;
    const ctx = _customCanvas.getContext('2d');
    const W = _customCanvas.width, H = _customCanvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#1a0d00';
    ctx.fillRect(0, 0, W, H);

    // 배치 불가능한 반대쪽 진영 영역 어둡게 처리
    const blackZoneY = ((0.5 + BOARD_V) / (BOARD_V * 2)) * H;
    const whiteZoneY = ((-0.5 + BOARD_V) / (BOARD_V * 2)) * H;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    if (_placingTeam === 'black') {
        ctx.fillRect(0, 0, W, whiteZoneY); 
    } else {
        ctx.fillRect(0, blackZoneY, W, H - blackZoneY); 
    }

    // 현재 배치 가능한 활성 영역 색상 강조
    const topY  = _placingTeam === 'black' ? blackZoneY : 0;
    const botY  = _placingTeam === 'black' ? H : whiteZoneY;
    ctx.fillStyle = _placingTeam === 'black'
        ? 'rgba(60,100,220,0.14)'
        : 'rgba(220,220,255,0.09)';
    ctx.fillRect(0, topY, W, botY - topY);

    // 보조선(그리드, 중앙선, 윤곽) 그리기
    ctx.strokeStyle = 'rgba(255,200,100,0.18)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(W * i / 8, 0); ctx.lineTo(W * i / 8, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, H * i / 8); ctx.lineTo(W, H * i / 8); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,200,100,0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,200,100,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.45, 0, Math.PI * 2); ctx.stroke();

    // 텍스트 레이블 표시
    ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    const wA = _placingTeam === 'white' ? 0.85 : 0.35;
    const bA = _placingTeam === 'black' ? 0.85 : 0.35;
    ctx.fillStyle = `rgba(200,220,255,${wA})`;
    ctx.fillText('백(White) 영역', W / 2, 15);
    ctx.fillStyle = `rgba(120,160,255,${bA})`;
    ctx.fillText('흑(Black) 영역', W / 2, H - 5);

    const r = Math.max(4, W / 24);

    // 흑돌 배치된 것 그리기 (현재 선택되지 않은 팀의 돌은 반투명)
    ctx.globalAlpha = _placingTeam === 'black' ? 1.0 : 0.3;
    customFormation.black.forEach(p => {
        const { cx, cy } = worldToCanvas(p.x, p.z, W);
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#555'); g.addColorStop(1, '#111');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#777'; ctx.lineWidth = 1; ctx.stroke();
    });

    // 백돌 배치된 것 그리기
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

// ── 포진 선택 화면(오버레이 UI) 관리 ──

let _selectedBlackId = 'DEFAULT';
let _selectedWhiteId = 'DEFAULT';
let _activeTeam      = 'black'; 
let _bCount          = 10;
let _wCount          = 10;
let _confirmCallback = null;

/** 
 * @function showFormationScreen
 * @description 게임 시작 버튼을 누른 후 포진 선택 모달 창을 띄움 
 */
export function showFormationScreen(bCount, wCount, onConfirm) {
    _bCount          = bCount;
    _wCount          = wCount;
    _selectedBlackId = 'DEFAULT';
    _selectedWhiteId = 'DEFAULT';
    _activeTeam      = 'black';
    _confirmCallback = onConfirm;
    _customBCount    = bCount;
    _customWCount    = wCount;

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

/** 흑팀/백팀 전환 탭 UI 구성 */
function _buildTeamTabs() {
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

/** 선택된 팀 탭을 바꾸고 해당 팀의 상태로 UI 갱신 */
function _switchTeamTab(team) {
    _activeTeam = team;

    document.getElementById('tab-formation-black')?.classList.toggle('active', team === 'black');
    document.getElementById('tab-formation-white')?.classList.toggle('active', team === 'white');

    const selectedId = team === 'black' ? _selectedBlackId : _selectedWhiteId;
    document.querySelectorAll('.formation-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.id === selectedId)
    );

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

/** FORMATIONS 배열에 기반하여 선택지(카드) DOM 생성 */
function _buildFormationCards() {
    const grid = document.getElementById('formation-grid');
    if (!grid) return;
    grid.innerHTML = '';

    FORMATIONS.forEach(f => {
        const card = document.createElement('div');
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

/** 포진 카드를 클릭했을 때 상태 저장 및 UI 갱신 */
function _selectFormation(id) {
    if (_activeTeam === 'black') _selectedBlackId = id;
    else                         _selectedWhiteId = id;

    document.querySelectorAll('.formation-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.id === id)
    );

    const badge = document.getElementById(`badge-${_activeTeam}`);
    if (badge) badge.textContent = FORMATIONS.find(f => f.id === id)?.name ?? id;

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

/** 초기화 등 기타 버튼 이벤트 맵핑 */
function _setupButtons() {
    const btnConfirm = document.getElementById('btn-confirm-formation');
    if (btnConfirm) btnConfirm.onclick = _handleConfirm;

    const btnClear = document.getElementById('btn-clear-custom');
    if (btnClear) btnClear.onclick = () => {
        customFormation[_activeTeam] = [];
        _redrawCustomEditor();
        _updateConfirmButton();
    };
}

/** 커스텀 모드에서 돌이 다 안채워졌을 경우 완료 버튼 비활성화 등 제어 */
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

/** 완료 버튼(게임 시작)을 누르면 실제 3D 오브젝트를 만들기 위한 좌표를 계산하여 반환 */
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
