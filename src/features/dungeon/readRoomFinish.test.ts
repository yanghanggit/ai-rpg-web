import { describe, expect, it } from "vitest";
import { dungeonFixture } from "../../mocks/fixtures";
import { readRoomFinish } from "./readRoomFinish";

/** `/state` 的响应（`useDungeonRun().data`）——只关心 `dungeon.current_room_index`。 */
function stateAt(index: number) {
  const dungeon = structuredClone(dungeonFixture);
  dungeon.current_room_index = index;
  return { dungeon };
}

describe("readRoomFinish", () => {
  it("还有下一间 → 去房间之间的地图", () => {
    const finish = readRoomFinish(stateAt(0), false);

    expect(finish.leavesRun).toBe(false);
    expect(finish.caption).toBe("回到地图");
    expect(finish.hint).toBe("本间结束后进不来。");
  });

  it("最后一间 → 直接离开副本（服务端推进必然拒绝）", () => {
    const finish = readRoomFinish(stateAt(dungeonFixture.rooms.length - 1), false);

    expect(finish.leavesRun).toBe(true);
    expect(finish.caption).toBe("离开副本");
    expect(finish.hint).toBe("这是最后一间，结束后离开副本回家园。");
  });

  it("打输了 → 只能离开副本（与现在是第几间无关）", () => {
    const finish = readRoomFinish(stateAt(0), true);

    expect(finish.leavesRun).toBe(true);
    expect(finish.hint).toBe("战斗失败，只能离开副本回家园。");
  });

  it("`/state` 还没回来 → 按「还有下一间」处理（去地图，那边对「没有可前往的房间」有兜底）", () => {
    const finish = readRoomFinish(undefined, false);

    expect(finish.leavesRun).toBe(false);
    expect(finish.caption).toBe("回到地图");
  });
});
