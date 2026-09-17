import { describe, expect, it } from "vitest";
import { combatFixture, roundFixture } from "../../mocks/fixtures";
import { COMBAT_STATE, deriveCombatPhase } from "./combatPhase";

describe("deriveCombatPhase", () => {
  it("NONE / INITIALIZATION → init（等待初始化）", () => {
    expect(deriveCombatPhase(combatFixture({ state: COMBAT_STATE.NONE }))).toBe("init");
    expect(deriveCombatPhase(combatFixture({ state: COMBAT_STATE.INITIALIZATION }))).toBe("init");
  });

  it("COMPLETE / POST_COMBAT → post（结算，两态合并）", () => {
    expect(deriveCombatPhase(combatFixture({ state: COMBAT_STATE.COMPLETE }))).toBe("post");
    expect(deriveCombatPhase(combatFixture({ state: COMBAT_STATE.POST_COMBAT }))).toBe("post");
  });

  it("ONGOING 且尚无回合 → round_start（需抓牌）", () => {
    expect(deriveCombatPhase(combatFixture({ state: COMBAT_STATE.ONGOING }))).toBe("round_start");
  });

  it("ONGOING 且最新回合尚未抓牌 → round_start", () => {
    const combat = combatFixture({
      state: COMBAT_STATE.ONGOING,
      rounds: [roundFixture({ draw_completed: false, current_actor: "角色.无名" })],
    });
    expect(deriveCombatPhase(combat)).toBe("round_start");
  });

  it("ONGOING 且最新回合已结束 → round_start（开新回合）", () => {
    const combat = combatFixture({
      state: COMBAT_STATE.ONGOING,
      rounds: [
        roundFixture({ draw_completed: true, is_completed: true, current_actor: "角色.无名" }),
      ],
    });
    expect(deriveCombatPhase(combat)).toBe("round_start");
  });

  it("ONGOING 且没有行动角色 → round_start", () => {
    const combat = combatFixture({
      state: COMBAT_STATE.ONGOING,
      rounds: [roundFixture({ draw_completed: true, current_actor: null })],
    });
    expect(deriveCombatPhase(combat)).toBe("round_start");
  });

  it("ONGOING 且有可行动角色 → turn", () => {
    const combat = combatFixture({
      state: COMBAT_STATE.ONGOING,
      rounds: [roundFixture({ draw_completed: true, current_actor: "角色.无名" })],
    });
    expect(deriveCombatPhase(combat)).toBe("turn");
  });

  it("只看最新回合：前几回合的状态不影响判定", () => {
    const combat = combatFixture({
      state: COMBAT_STATE.ONGOING,
      rounds: [
        roundFixture({ draw_completed: true, is_completed: true, current_actor: null }),
        roundFixture({ draw_completed: true, current_actor: "怪物.纸人" }),
      ],
    });
    expect(deriveCombatPhase(combat)).toBe("turn");
  });

  it("retreated（撤退）时仍以 state 为准，不单独开 phase", () => {
    const combat = combatFixture({ state: COMBAT_STATE.POST_COMBAT, retreated: true });
    expect(deriveCombatPhase(combat)).toBe("post");
  });
});
