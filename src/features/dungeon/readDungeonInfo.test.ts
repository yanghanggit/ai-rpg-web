import { describe, expect, it } from "vitest";
import { dungeonFixture } from "../../mocks/fixtures";
import { readDungeonInfo } from "./readDungeonInfo";

describe("readDungeonInfo", () => {
  it("整理房间：类型、场景名与敌人", () => {
    const info = readDungeonInfo(dungeonFixture);

    expect(info.name).toBe("副本.荒村义庄");
    expect(info.rooms).toHaveLength(2);
    expect(info.rooms[0]?.type).toBe("opening");
    expect(info.rooms[0]?.stageName).toBe("场景.义庄前院");
    expect(info.rooms[0]?.monsters).toEqual([]);
    expect(info.rooms[1]?.type).toBe("combat");
    expect(info.rooms[1]?.monsters.map((monster) => monster.name)).toEqual([
      "怪物.纸人",
      "怪物.棺中殭尸",
    ]);
  });

  it("只把 Monster 当敌人（NPC 不算）", () => {
    const dungeon = structuredClone(dungeonFixture);
    const combat = dungeon.rooms[1];
    if (combat?.type !== "combat") {
      throw new Error("fixture 结构变了");
    }
    const npc = structuredClone(combat.stage.actors[0]);
    if (npc === undefined) {
      throw new Error("fixture 结构变了");
    }
    npc.name = "角色.友方";
    npc.type = "NPC";
    combat.stage.actors.push(npc);

    const info = readDungeonInfo(dungeon);
    expect(info.rooms[1]?.monsters.map((monster) => monster.name)).not.toContain("角色.友方");
  });

  it("created_at 缺失时返回 null；解析不了就原样返回", () => {
    expect(readDungeonInfo({ ...dungeonFixture, created_at: undefined }).createdAt).toBeNull();
    expect(readDungeonInfo({ ...dungeonFixture, created_at: "not-a-date" }).createdAt).toBe(
      "not-a-date",
    );
  });

  it("created_at 压成 YYYY-MM-DD HH:MM", () => {
    const info = readDungeonInfo({ ...dungeonFixture, created_at: "2026-09-11T12:00:00Z" });
    expect(info.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
