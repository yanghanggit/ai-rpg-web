/**
 * mock 用的内存副本列表（`GET /api/home/dungeon-list/v1/` 的数据源）。
 *
 * 真实后端把副本存成磁盘上的 JSON 文件（`game/config.py` 的 `DUNGEONS_DIR`），
 * 列表接口读取全部文件并按创建时间排序；「生成副本」走异步 pipeline 写出一份新 JSON。
 * mock 里就用这一个数组模拟，让 `pnpm dev:mock` 下
 * 「生成 → 列表变长 → 查阅静态数据」这条链路可见。
 */
import type { Schemas } from "../api/types";
import {
  readMockCombat,
  readMockCombatParticipants,
  resetMockCombat,
  resetMockCombatState,
} from "./combat";
import { blueprintFixture, dungeonFixture, emptyDungeonFixture } from "./fixtures";
import { enterMockOpeningParty, leaveMockOpening, readMockPartyNames } from "./opening";
import { readMockRosterNames } from "./roster";
import { moveMockActorsToStage, resetMockStages } from "./stages";

let dungeons: Schemas["Dungeon"][] = [structuredClone(dungeonFixture)];
let generatedCount = 0;

/** 进行中的副本（`world.dungeon`）：名字为空即无副本，`current_room_index` 为 -1 即未进入。 */
let runningName = "";
let runningRoomIndex = -1;

/** 当前可用副本列表（按创建时间升序，与后端 `sorted(..., key=created_at)` 一致）。 */
export function readMockDungeons(): Schemas["Dungeon"][] {
  return [...dungeons].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}

/** 按名字取当前正在进行的副本（没有副本时为 undefined）。 */
function runningDungeon(): Schemas["Dungeon"] | undefined {
  return dungeons.find((item) => item.name === runningName);
}

/**
 * 副本运行状态（`GET /api/dungeons/v1/{user}/{game}/state`）。
 *
 * 真实后端把 `world.dungeon` 当当前副本：没有副本时是空副本（空名字、无房间、
 * `current_room_index = -1`），退出副本时 `teardown_dungeon` 又把它重置回空副本。
 * 这里用同一条时间线：初始空副本，「进入副本」后变成进行中的那一份。
 */
export function readMockDungeonState(): Schemas["DungeonStateResponse"] {
  const dungeon = runningDungeon();
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

/** 当前副本房间（`GET /api/dungeons/v1/{user}/{game}/room`）。
 *
 * 后端在 `current_room_index == -1`（没有进行中的房间）时返回 404，所以这里也用 `null`
 * 表示「没有」，由 handler 转成 404——客户端不靠空值兜底。战斗房间的 `combat` 用
 * `./combat` 的实时状态覆盖，其余字段仍来自静态副本 fixture。
 */
export function readMockDungeonRoom(): Schemas["DungeonRoomResponse"]["room"] | null {
  const dungeon = runningDungeon();
  const room = dungeon?.rooms[runningRoomIndex];
  if (room === undefined) {
    return null;
  }
  if (room.type === "combat") {
    return { type: "combat", stage: structuredClone(room.stage), combat: readMockCombat() };
  }
  return structuredClone(room);
}

/**
 * 把队伍（战斗房间还包括怪物）搬进当前房间的场景，并在进入战斗房间时复位战斗。
 *
 * 对齐后端：`enter` / `advance_stage` 都会迁移队伍，且推进到战斗房间时把
 * `combat.state` 置为 `INITIALIZATION`（见 `services/dungeon_advance_action.py`）。
 */
function syncMockRoomPlacement(): void {
  const dungeon = runningDungeon();
  const room = dungeon?.rooms[runningRoomIndex];
  if (room === undefined) {
    return;
  }
  if (room.type === "combat") {
    const monsters = room.stage.actors
      .filter((actor) => actor.type === "Monster")
      .map((actor) => actor.name);
    resetMockCombat(monsters);
    moveMockActorsToStage(room.stage.name, readMockCombatParticipants());
  } else {
    moveMockActorsToStage(room.stage.name, readMockPartyNames());
  }
}

/** 发起进入副本：与后端一样，已有副本在跑时拒绝；成功则同时固化队伍。 */
export function enterMockDungeon(name: string): { ok: true } | { ok: false; error: string } {
  if (runningRoomIndex >= 0) {
    return { ok: false, error: `当前副本 ${runningName} 正在进行中，请先退出` };
  }
  if (!dungeons.some((item) => item.name === name)) {
    return { ok: false, error: `副本实体创建失败` };
  }
  runningName = name;
  runningRoomIndex = 0;
  // 后端在同一步里把玩家与名单成员固化成队伍，所以这里也一行做完:
  // 分开两个模块自己调，迟早有一个调用点忘掉（测试就抓到过一次）。
  enterMockOpeningParty([blueprintFixture.player_actor, ...readMockRosterNames()]);
  // 队伍被搬到第一间房的场景（战斗房间还要额外放上怪物并复位战斗）
  syncMockRoomPlacement();
  return { ok: true };
}

/** 退出副本：与后端任务一样，退出后世界回到「没有副本在跑」（副本拆掉、队伍解散）。 */
export function exitMockDungeon(): void {
  runningName = "";
  runningRoomIndex = -1;
  leaveMockOpening();
  // 队伍回到家园场景、战斗状态清空
  resetMockStages();
  resetMockCombatState();
}

/**
 * 进入下一关：`current_room_index + 1`（同步完成，真实后端也是同步接口）。
 *
 * 没有下一间时返回 `false`——对应后端 409「副本已全部通关，请返回营地」。
 */
export function advanceMockDungeon(): boolean {
  const dungeon = runningDungeon();
  if (dungeon === undefined || runningRoomIndex + 1 >= dungeon.rooms.length) {
    return false;
  }
  runningRoomIndex += 1;
  // 推进到新房间：队伍迁移；若是战斗房间，战斗复位为 INITIALIZATION
  syncMockRoomPlacement();
  return true;
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
