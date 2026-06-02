/**
 * @file SkillManager.js
 * @description
 * - 게임 내 모든 스킬(공격/방해)을 중앙에서 등록하고 관리하는 클래스
 * - UI나 입력 이벤트(마우스 클릭/드래그), 물리 충돌 이벤트를 받아 현재 선택된 활성 스킬로 전달(위임)
 * - 각 팀(흑/백)의 스킬 사용 여부를 추적하여 1회 사용 제한 및 턴 리셋 로직 처리
 */

import { state } from './state.js';
import { DefaultSkill }           from './skills/DefaultSkill.js';
import { TeleportSkill }          from './skills/TeleportSkill.js';
import { DestroySkill }           from './skills/DestroySkill.js';
import { RepulseSkill }           from './skills/RepulseSkill.js';
import { RhythmSkill }            from './skills/RhythmSkill.js';
import { WallSkill }              from './skills/WallSkill.js';
import { MineSkill }              from './skills/MineSkill.js';
import { BlindSkill }             from './skills/BlindSkill.js';
import { IceSkill }               from './skills/IceSkill.js';
import { BlackHoleSkill }         from './skills/BlackHoleSkill.js';
import { OpponentTeleportSkill }  from './skills/OpponentTeleportSkill.js';

export class SkillManager {
    constructor() {
        /** @type {Map<string, Object>} skills - 스킬 ID를 키로 하여 스킬 인스턴스를 저장하는 딕셔너리 */
        this.skills = new Map();
        /** @type {string} currentSkillId - 현재 선택되어 조준/사용 대기 중인 스킬의 ID */
        this.currentSkillId  = "NONE";
        /** @type {string|null} executingSkillId - 방금 충돌 등으로 인해 실제 효과가 발동된 스킬 ID */
        this.executingSkillId = null;
    }

    /**
     * @function initSkills
     * @description 게임에서 사용할 모든 공격 및 방해 스킬의 인스턴스를 생성하고 내부 맵에 등록
     */
    initSkills() {
        // ── 공격 스킬 ──
        this.registerSkill(new DefaultSkill());
        this.registerSkill(new TeleportSkill());
        this.registerSkill(new DestroySkill());
        this.registerSkill(new RepulseSkill());
        this.registerSkill(new RhythmSkill());
        this.registerSkill(new WallSkill());
        // ── 방해 스킬 ──
        this.registerSkill(new MineSkill());
        this.registerSkill(new BlindSkill());
        this.registerSkill(new IceSkill());
        this.registerSkill(new BlackHoleSkill());
        this.registerSkill(new OpponentTeleportSkill());
    }

    /** 개별 스킬 인스턴스 등록 헬퍼 */
    registerSkill(skill) {
        this.skills.set(skill.id, skill);
    }

    /**
     * @function setSkill
     * @description
     * - 플레이어가 UI에서 스킬을 선택했을 때 호출됨
     * - 기존 스킬의 onDeactivate()를 부르고 새 스킬의 onActivate()를 호출하여 상태 갱신
     */
    setSkill(id) {
        if (this.currentSkillId === id) return;

        const prev = this.skills.get(this.currentSkillId);
        if (prev) prev.onDeactivate();

        this.currentSkillId = id;
        state.currentSkill  = id;

        const next = this.skills.get(id);
        if (next) next.onActivate();
    }

    /** 현재 활성화된 스킬 인스턴스 반환 */
    get currentSkill() {
        return this.skills.get(this.currentSkillId);
    }

    // ── 스킬 사용 기록(Tracking) ──

    /**
     * @function markSkillUsed
     * @description
     * - 스킬을 실제로 발사(또는 사용 확정)했을 때 해당 팀의 사용 목록(Set)에 추가하여 다시 쓰지 못하게 막음
     * @param {string} playerColor - 'black' 또는 'white'
     * @param {string} skillId - 사용한 스킬 ID
     */
    markSkillUsed(playerColor, skillId) {
        if (!skillId || skillId === 'NONE') return;
        if (!state.usedSkills[playerColor]) return;
        state.usedSkills[playerColor].add(skillId);
    }

    /** 특정 스킬이 현재 턴 플레이어에 의해 이미 사용되었는지 여부 반환 */
    isSkillUsed(skillId) {
        if (!skillId || skillId === 'NONE') return false;
        return state.usedSkills[state.currentTurn]?.has(skillId) ?? false;
    }

    /**
     * @function clearAllPersistentEffects
     * @description
     * - 지뢰, 블랙홀, 얼음 장판 등 턴이 지나도 필드에 남아있는 모든 지속 효과를 강제 제거
     * - 주로 게임 재시작 시 호출
     */
    clearAllPersistentEffects() {
        for (const skill of this.skills.values()) {
            skill.clearAll();
        }
    }

    // ── 입력 이벤트 라우팅(위임) ──
    // interaction.js에서 마우스 이벤트를 받았을 때 현재 스킬에게 먼저 기회를 줌

    handleInteraction(intersects, pointerPos, selectionRing) {
        if (this.currentSkill)
            return this.currentSkill.onInteract(intersects, pointerPos, selectionRing);
        return false;
    }

    handlePointerDown(intersects, pointerPos) {
        if (this.currentSkill)
            return this.currentSkill.onPointerDown(intersects, pointerPos);
        return false;
    }

    handlePointerMove(intersects, pointerPos) {
        if (this.currentSkill)
            return this.currentSkill.onPointerMove(intersects, pointerPos);
        return false;
    }

    handlePointerUp(intersects, pointerPos) {
        if (this.currentSkill)
            return this.currentSkill.onPointerUp(intersects, pointerPos);
        return false;
    }

    /**
     * @function handleCollision
     * @description
     * - 물리 엔진에서 돌끼리 충돌했을 때 호출
     * - 현재 스킬(발사된 스킬)의 onCollision() 로직을 실행하여 폭발, 넉백 등의 특수 효과 발동
     */
    handleCollision(attacker, defender, midPoint) {
        if (this.currentSkill) {
            this.executingSkillId = this.currentSkillId;
            this.currentSkill.onCollision(attacker, defender, midPoint);
        }
    }

    /** 매 프레임 모든 스킬의 시각 효과(VFX, 파티클, 애니메이션) 업데이트 */
    updateVFX(deltaTime) {
        for (const skill of this.skills.values()) {
            skill.updateVFX(deltaTime);
        }
    }

    /**
     * @function resetTurn
     * @description
     * - 턴이 끝났을 때 발동. 모든 스킬의 임시 시각 효과(조준선 등)를 정리하고, 다음 턴을 위해 선택 스킬을 'NONE'으로 초기화
     * - 방해 스킬의 1턴 제한 플래그도 여기서 해제
     */
    resetTurn() {
        state.disruptionUsedLastTurn = false;
        for (const skill of this.skills.values()) {
            skill.dispose();
        }
        this.setSkill("NONE");
    }

    /** UI 구성을 위해 전체 스킬 목록 배열 반환 */
    getRegisteredSkills() {
        return Array.from(this.skills.values());
    }
}

export const skillManager = new SkillManager();
