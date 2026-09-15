/**
 * mock 用的内存副本列表（`GET /api/home/dungeon-list/v1/` 的数据源）。
 *
 * 真实后端把副本存成磁盘上的 JSON 文件（`game/config.py` 的 `DUNGEONS_DIR`），
 * 列表接口读取全部文件并按创建时间排序；「生成副本」走异步 pipeline 写出一份新 JSON。
 * mock 里就用这一个数组模拟，让 `pnpm dev:mock` 下
 * 「生成 → 列表变长 → 查阅静态数据」这条链路可见。
 */
import type { Schemas } from "../api/types";
import { dungeonFixture } from "./fixtures";

let dungeons: Schemas["Dungeon"][] = [structuredClone(dungeonFixture)];
let generatedCount = 0;

/** 当前可用副本列表（按创建时间升序，与后端 `sorted(..., key=created_at)` 一致）。 */
export function readMockDungeons(): Schemas["Dungeon"][] {
  return [...dungeons].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
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
}
