import { describe, expect, it } from "vitest";
import { readMockCombat } from "./combat";
import { readMockDungeonRoom } from "./dungeons";
import { readMockOpeningInitialized, readMockSpoilsHolders } from "./opening";
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
});
