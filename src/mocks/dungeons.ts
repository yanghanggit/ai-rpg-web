/**
 * mock 用的内存副本列表（`GET /api/home/dungeon-list/v1/` 的数据源）。
 *
 * 真实后端把副本存成磁盘上的 JSON 文件（`game/config.py` 的 `DUNGEONS_DIR`），
 * 列表接口读取全部文件并按创建时间排序；「生成副本」走异步 pipeline 写出一份新 JSON。
 * mock 里就用这一个数组模拟，让 `pnpm dev:mock` 下
 * 「生成 → 列表变长 → 查阅静态数据」这条链路可见。
 */
import type { Schemas } from "../api/types";
import { dungeonFixture, emptyDungeonFixture } from "./fixtures";

let dungeons: Schemas["Dungeon"][] = [structuredClone(dungeonFixture)];
let generatedCount = 0;

/** 进行中的副本（`world.dungeon`）：名字为空即无副本，`current_room_index` 为 -1 即未进入。 */
let runningName = "";
let runningRoomIndex = -1;

/** 当前可用副本列表（按创建时间升序，与后端 `sorted(..., key=created_at)` 一致）。 */
export function readMockDungeons(): Schemas["Dungeon"][] {
  return [...dungeons].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}

/**
 * 副本运行状态（`GET /api/dungeons/v1/{user}/{game}/state`）。
 *
 * 真实后端把 `world.dungeon` 当当前副本：没有副本时是空副本（空名字、无房间、
 * `current_room_index = -1`），退出副本时 `teardown_dungeon` 又把它重置回空副本。
 * 这里用同一条时间线：初始空副本，「进入副本」后变成进行中的那一份。
 */
export function readMockDungeonState(): Schemas["DungeonStateResponse"] {
  const dungeon = dungeons.find((item) => item.name === runningName);
  if (dungeon === undefined) {
    return { dungeon: structuredClone(emptyDungeonFixture) };
  }
  return {
    dungeon: {
      ...structuredClone(dungeon),
      current_room_index: runningRoomIndex,
      setup_entities: true,
    },
  };
}

/** 发起进入副本：与后端一样，已有副本在跑时拒绝。 */
export function enterMockDungeon(name: string): { ok: true } | { ok: false; error: string } {
  if (runningRoomIndex >= 0) {
    return { ok: false, error: `当前副本 ${runningName} 正在进行中，请先退出` };
  }
  if (!dungeons.some((item) => item.name === name)) {
    return { ok: false, error: `副本实体创建失败` };
  }
  runningName = name;
  runningRoomIndex = 0;
  return { ok: true };
}

/** 生成一份新副本并追加到列表，返回它（mock 里同步完成，真实后端是异步 pipeline）。 */
export function generateMockDungeon(): Schemas["Dungeon"] {
  generatedCount += 1;
  const dungeon = structuredClone(dungeonFixture);
  dungeon.name = `副本.试炼之地${generatedCount}`;
  dungeon.created_at = new Date().toISOString();
  dungeons.push(dungeon);
  return dungeon;
}

/** 复位成初始 fixture（测试之间隔离）。 */
export function resetMockDungeons(): void {
  dungeons = [structuredClone(dungeonFixture)];
  generatedCount = 0;
  runningName = "";
  runningRoomIndex = -1;
}
