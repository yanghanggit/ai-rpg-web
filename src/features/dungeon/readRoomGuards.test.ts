import { describe, expect, it } from "vitest";
import { combatRoomFixture, openingRoomFixture } from "../../mocks/fixtures";
import { COMBAT_RESULT, COMBAT_STATE } from "./combat/combatPhase";
import { readRoomGuards } from "./readRoomGuards";

/**
 * 这份判据只回答两件**本间状态自身**的事：本间结束了没有、打输了没有。
 * "能不能推进 / 能不能离开副本"不在这里——那是服务端接口自己的前置检查。
 */
describe("readRoomGuards", () => {
  it("开场房间：未初始化 → 本间没结束", () => {
    const guards = readRoomGuards(openingRoomFixture(false));

    expect(guards.done).toBe(false);
    expect(guards.defeated).toBe(false);
  });

  it("开场房间：已初始化 → 本间结束", () => {
    const guards = readRoomGuards(openingRoomFixture(true));

    expect(guards.done).toBe(true);
    expect(guards.defeated).toBe(false);
  });

  it("战斗房间：未结束 → 本间没结束", () => {
    const guards = readRoomGuards(
      combatRoomFixture({ combat: { state: COMBAT_STATE.ONGOING, result: COMBAT_RESULT.NONE } }),
    );

    expect(guards.done).toBe(false);
    expect(guards.defeated).toBe(false);
  });

  it("战斗房间：COMPLETE 不算结束——服务端的 is_post_combat 只认 POST_COMBAT", () => {
    // 这是最容易写错的一格：`combatPhase` 把 COMPLETE 与 POST_COMBAT 合并成 "post"，
    // 直接用它当判据就会放出"结束本间"，点下去被服务端拒。
    const guards = readRoomGuards(
      combatRoomFixture({ combat: { state: COMBAT_STATE.COMPLETE, result: COMBAT_RESULT.WIN } }),
    );

    expect(guards.done).toBe(false);
  });

  it("战斗房间：战后胜利 → 本间结束，没打输", () => {
    const guards = readRoomGuards(
      combatRoomFixture({
        combat: { state: COMBAT_STATE.POST_COMBAT, result: COMBAT_RESULT.WIN },
      }),
    );

    expect(guards.done).toBe(true);
    expect(guards.defeated).toBe(false);
  });

  it("战斗房间：战后失败 → 本间结束，但打输了（只剩离开副本这一条路）", () => {
    const guards = readRoomGuards(
      combatRoomFixture({
        combat: { state: COMBAT_STATE.POST_COMBAT, result: COMBAT_RESULT.LOSE },
      }),
    );

    expect(guards.done).toBe(true);
    expect(guards.defeated).toBe(true);
  });
});
