import { describe, expect, it } from "vitest";
import { readMockCombat, readMockHand } from "./combat";
import { readMockDungeonRoom } from "./dungeons";
import {
  consumeFailNextOpeningInit,
  readMockClaimedCount,
  readMockOpeningInitialized,
  readMockPartyNames,
  readMockSpoilsHolders,
} from "./opening";
import { seedMockFromUrl } from "./seedMockFromUrl";

const BASE = "http://localhost/game/webdev/Game1/dungeon/room";

describe("seedMockFromUrl", () => {
  it("没有 seed 参数时什么都不做", () => {
    seedMockFromUrl(BASE);
    expect(readMockDungeonRoom()).toBeNull();
    expect(readMockCombat().state).toBe(0);
  });

  it("未知 token 不抛异常、不改状态", () => {
    seedMockFromUrl(`${BASE}?seed=nope`);
    expect(readMockDungeonRoom()).toBeNull();
    expect(readMockCombat().state).toBe(0);
  });

  it("opening:fresh → 开场房间且尚未初始化（刚进入副本的样子）", () => {
    seedMockFromUrl(`${BASE}?seed=opening:fresh`);
    expect(readMockDungeonRoom()?.type).toBe("opening");
    expect(readMockOpeningInitialized()).toBe(false);
  });

  it("opening:init-failed → 第一次初始化失败（只剩重试能救）", () => {
    seedMockFromUrl(`${BASE}?seed=opening:init-failed`);
    expect(readMockDungeonRoom()?.type).toBe("opening");
    expect(consumeFailNextOpeningInit()).toBe(true);
    // 只失败一次：重试就会成功
    expect(consumeFailNextOpeningInit()).toBe(false);
    expect(readMockOpeningInitialized()).toBe(false);
  });

  it("opening:ready → 开场房间且已初始化", () => {
    seedMockFromUrl(`${BASE}?seed=opening:ready`);
    expect(readMockDungeonRoom()?.type).toBe("opening");
    expect(readMockOpeningInitialized()).toBe(true);
  });

  it("opening:spoils → 开场房间且已生成奖励", () => {
    seedMockFromUrl(`${BASE}?seed=opening:spoils`);
    expect(readMockDungeonRoom()?.type).toBe("opening");
    expect(readMockSpoilsHolders().length).toBeGreaterThan(0);
  });

  it("opening:claimed → 已生成奖励且已领走一张", () => {
    seedMockFromUrl(`${BASE}?seed=opening:claimed`);
    expect(readMockDungeonRoom()?.type).toBe("opening");
    expect(readMockClaimedCount("角色.零号")).toBe(1);
  });

  it("combat:init → 战斗房间处于 INITIALIZATION", () => {
    seedMockFromUrl(`${BASE}?seed=combat:init`);
    expect(readMockDungeonRoom()?.type).toBe("combat");
    expect(readMockCombat().state).toBe(1);
    expect(readMockCombat().rounds).toHaveLength(0);
  });

  it("combat:round_start → ONGOING 且没有回合", () => {
    seedMockFromUrl(`${BASE}?seed=combat:round_start`);
    expect(readMockCombat().state).toBe(2);
    expect(readMockCombat().rounds).toHaveLength(0);
  });

  it("combat:turn → ONGOING 且回合已抓牌、有行动角色", () => {
    seedMockFromUrl(`${BASE}?seed=combat:turn`);
    const combat = readMockCombat();
    expect(combat.state).toBe(2);
    expect(combat.rounds).toHaveLength(1);
    expect(combat.rounds[0]?.draw_completed).toBe(true);
    expect(combat.rounds[0]?.current_actor).toBeTruthy();
  });

  it("combat:post → POST_COMBAT 且已分出胜负", () => {
    seedMockFromUrl(`${BASE}?seed=combat:post`);
    const combat = readMockCombat();
    expect(combat.state).toBe(4);
    expect(combat.result).toBe(1);
  });

  it("combat:multihit → 玩家手牌全是多段命中卡（方便看 `连击 ×N`）", () => {
    seedMockFromUrl(`${BASE}?seed=combat:multihit`);
    expect(readMockCombat().state).toBe(2);

    const hand = readMockHand("角色.零号");
    expect(hand.map((card) => card.name)).toEqual(["钉入", "过载横击", "撒噪声", "双锋", "乱流"]);
    expect(hand.every((card) => typeof card.hit_count === "number" && card.hit_count > 1)).toBe(
      true,
    );
  });

  // 放最后：它会改队伍名单（module 级状态），后面的用例都靠前面的空名单
  it("party:full → 队伍含玩家与两名同伴", () => {
    seedMockFromUrl(`${BASE}?seed=party:full`);
    expect(readMockDungeonRoom()?.type).toBe("opening");
    expect(readMockPartyNames()).toEqual(["角色.零号", "角色.螳螂", "角色.麻雀"]);
  });
});
