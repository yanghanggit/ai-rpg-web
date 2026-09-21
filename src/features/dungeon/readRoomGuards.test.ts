import { describe, expect, it } from "vitest";
import { combatRoomFixture, openingRoomFixture } from "../../mocks/fixtures";
import { COMBAT_RESULT, COMBAT_STATE } from "./combat/combatPhase";
import { readRoomGuards } from "./readRoomGuards";

/**
 * 这份判据是服务端两处房间检查的**镜像**，所以用例逐条对着
 * `services/dungeon_advance_action.py` 与 `services/dungeon_exit_action.py` 写。
 */
describe("readRoomGuards", () => {
  it("开场房间：未初始化 → 不能推进，也不能离开副本（服务端两处都拦）", () => {
    const guards = readRoomGuards(openingRoomFixture(false));

    expect(guards.done).toBe(false);
    expect(guards.pendingReason).toBe("开场房间尚未初始化，无法推进");
    expect(guards.exitBlocked).toBe(true);
    expect(guards.exitBlockedHint).not.toBeNull();
  });

  it("开场房间：已初始化 → 本间结束，可以推进、可以离开", () => {
    const guards = readRoomGuards(openingRoomFixture(true));

    expect(guards.done).toBe(true);
    expect(guards.pendingReason).toBeNull();
    expect(guards.defeated).toBe(false);
    expect(guards.exitBlocked).toBe(false);
    expect(guards.exitBlockedHint).toBeNull();
  });

  it("战斗房间：未结束 → 不能推进（离开副本不预判，交给后端）", () => {
    const guards = readRoomGuards(
      combatRoomFixture({ combat: { state: COMBAT_STATE.ONGOING, result: COMBAT_RESULT.NONE } }),
    );

    expect(guards.done).toBe(false);
    expect(guards.pendingReason).toBe("战斗未结束，无法推进");
    expect(guards.exitBlocked).toBe(false);
  });

  it("战斗房间：COMPLETE 不算结束——服务端的 is_post_combat 只认 POST_COMBAT", () => {
    // 这是最容易写错的一格：`combatPhase` 把 COMPLETE 与 POST_COMBAT 合并成 "post"，
    // 直接用它当判据就会放出"前往下一间"，点下去被服务端拒。
    const guards = readRoomGuards(
      combatRoomFixture({ combat: { state: COMBAT_STATE.COMPLETE, result: COMBAT_RESULT.WIN } }),
    );

    expect(guards.done).toBe(false);
    expect(guards.pendingReason).toBe("战斗未结束，无法推进");
  });

  it("战斗房间：战后胜利 → 本间结束，可以推进", () => {
    const guards = readRoomGuards(
      combatRoomFixture({
        combat: { state: COMBAT_STATE.POST_COMBAT, result: COMBAT_RESULT.WIN },
      }),
    );

    expect(guards.done).toBe(true);
    expect(guards.defeated).toBe(false);
    expect(guards.pendingReason).toBeNull();
  });

  it("战斗房间：战后失败 → 本间结束但只能离开副本，不能推进", () => {
    const guards = readRoomGuards(
      combatRoomFixture({
        combat: { state: COMBAT_STATE.POST_COMBAT, result: COMBAT_RESULT.LOSE },
      }),
    );

    expect(guards.done).toBe(true);
    expect(guards.defeated).toBe(true);
  });
});
