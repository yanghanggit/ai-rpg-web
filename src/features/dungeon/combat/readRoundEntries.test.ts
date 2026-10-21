import { describe, expect, it } from "vitest";
import type { Schemas } from "../../../api/types";
import { readEntriesSince, snapshotEntries } from "./readRoundEntries";

/** 造一个只关心 `entries` 的回合（其余字段与"这次动作新增了什么"无关）。 */
function round(...logs: string[]): Schemas["Round"] {
  return {
    completed_actors: [],
    action_order: [],
    current_actor: null,
    is_completed: false,
    draw_completed: true,
    entries: logs.map((log) => ({ kind: "cards" as const, log, narrative: "" })),
  };
}

const logs = (entries: Schemas["RoundEntry"][]): string[] => entries.map((entry) => entry.log);

describe("回合记录的新增条目", () => {
  it("没有回合时快照为 null，也就没有新增（进房那一屏）", () => {
    expect(snapshotEntries([])).toBeNull();
    expect(readEntriesSince([], null)).toEqual([]);
  });

  it("只取快照之后追加的那些，位置就是最后一回合的末尾", () => {
    const before = [round("a", "b"), round("c")];
    const snapshot = snapshotEntries(before);
    expect(snapshot).toEqual({ roundIndex: 1, count: 1 });

    const after = [round("a", "b"), round("c", "d", "e")];
    expect(logs(readEntriesSince(after, snapshot))).toEqual(["d", "e"]);
  });

  it("过牌跨回合：本回合新增 + 下一回合的条目都算这一次的产出", () => {
    const snapshot = snapshotEntries([round("a")]);
    // 本回合收尾记一条，随后开第 2 回合并记了一条（下回合的记录不该被吞掉）
    const after = [round("a", "b"), round("c")];
    expect(logs(readEntriesSince(after, snapshot))).toEqual(["b", "c"]);
  });

  it("没有新增时给空数组（动作失败 / 过牌但没有词缀可结算）", () => {
    const snapshot = snapshotEntries([round("a")]);
    expect(readEntriesSince([round("a")], snapshot)).toEqual([]);
  });
});
