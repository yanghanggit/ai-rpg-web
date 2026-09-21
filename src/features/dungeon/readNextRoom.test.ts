import { describe, expect, it } from "vitest";
import { dungeonFixture } from "../../mocks/fixtures";
import { readNextRoom } from "./readNextRoom";

/** 每次都从 fixture 克隆一份：这两个用例会改 `current_room_index`，不能污染共享 fixture。 */
function dungeonAt(index: number) {
  const dungeon = structuredClone(dungeonFixture);
  dungeon.current_room_index = index;
  return dungeon;
}

describe("readNextRoom", () => {
  it("没有进行中的副本 → null", () => {
    expect(readNextRoom(null)).toBeNull();
  });

  it("第 1 间 → 第 2 间", () => {
    const dungeon = dungeonAt(0);
    expect(readNextRoom(dungeon)?.stage.name).toBe(dungeon.rooms[1]?.stage.name);
  });

  it("最后一间 → null（没有可前往的房间）", () => {
    const dungeon = dungeonAt(dungeonFixture.rooms.length - 1);
    expect(readNextRoom(dungeon)).toBeNull();
  });

  it("还没进入副本（索引 -1）→ 第 1 间", () => {
    const dungeon = dungeonAt(-1);
    expect(readNextRoom(dungeon)?.stage.name).toBe(dungeon.rooms[0]?.stage.name);
  });
});
