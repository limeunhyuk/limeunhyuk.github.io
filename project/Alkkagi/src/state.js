/**
 * @file state.js
 * @description
 * - 게임 전체에서 공유되는 전역 상태(Global State) 데이터를 중앙 집중식으로 보관하는 저장소
 * - 로직이나 메서드는 포함하지 않으며, 오직 데이터 저장 및 상태 공유의 역할만 수행
 */

export const state = {
    // ── 게임 흐름 및 페이즈 ──
    /** 
     * @type {string} gameState
     * - 현재 게임의 상태 (진행 단계)
     * - 허용값: "MENU"(시작 화면), "AIMING"(조준 중), "MOVING"(돌이 움직이는 중), "ZOOMING_IN/OUT"(카메라 연출 중), "MINIGAME"(미니게임 진행 중), "GAMEOVER"(게임 종료), "RETURN_TO_AIM"(조준 화면 복귀 중)
     */
    gameState: "MENU",           
    /** @type {string} currentTurn - 현재 턴 ("black" 또는 "white") */
    currentTurn: "black",
    /** @type {boolean} firstCollisionOccurred - 한 턴 안에서 스킬 중복 발동을 막기 위한 첫 충돌 체크 플래그 */
    firstCollisionOccurred: false, 
    
    // ── 점수 및 생존 현황 ──
    /** @type {number} totalBlack - 게임 시작 시 흑돌 총 개수 */
    totalBlack: 10,
    /** @type {number} totalWhite - 게임 시작 시 백돌 총 개수 */
    totalWhite: 10,
    /** @type {number} currentBlack - 현재 보드에 남은 흑돌 개수 */
    currentBlack: 10,
    /** @type {number} currentWhite - 현재 보드에 남은 백돌 개수 */
    currentWhite: 10,

    // ── 물리 연산 및 타이밍 제어 ──
    /** @type {number} currentSlowMoFactor - 슬로우 모션 연출 배율 (1.0 = 정상 속도, < 1.0 = 느려짐) */
    currentSlowMoFactor: 1.0,    
    /** @type {number} frameCount - 누적 렌더링 프레임 수 (파티클 등 시간 기반 연산에 사용) */
    frameCount: 0,

    // ── 스킬 시스템 상태 ──
    /** @type {string} currentSkill - UI에서 현재 선택되어 대기 중인 스킬 ID */
    currentSkill: "NONE",        
    /** @type {string} projectileSkill - 다음 충돌 발생 시 발동할 확정된 투사체형 스킬 ID */
    projectileSkill: "NONE",     
    /** @type {Object|null} teleportSelectedStone - 텔레포트 스킬 사용 시 선택된 대상 돌의 정보 */
    teleportSelectedStone: null,

    // ── 마우스 상호작용 및 카메라 추적 대기열 ──
    /** @type {Object|null} draggedStone - 현재 마우스로 드래그 중인 돌 객체 */
    draggedStone: null,
    /** @type {Object|null} lockedPair - 액션 카메라가 추적하고 있는, 가장 가까운 돌들의 쌍(Pair) */
    lockedPair: null,            

    // ── 스킬 사용 이력 추적 ──
    /** 
     * @type {Object} usedSkills 
     * - 게임 1판당 플레이어별로 스킬은 한 번씩만 사용 가능함을 기록하는 Set 
     */
    usedSkills: { black: new Set(), white: new Set() },

    // ── 방해(Disruption) 밸런스 제어 ──
    /** 
     * @type {boolean} disruptionUsedLastTurn
     * - 연속 방해 스킬 사용을 막기 위한 플래그
     * - 이전 턴에 상대방이 방해 스킬(예: 반사 등)을 썼다면 현재 턴 플레이어는 방해 스킬 사용 불가
     */
    disruptionUsedLastTurn: false
};
