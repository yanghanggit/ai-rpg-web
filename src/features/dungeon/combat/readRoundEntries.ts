import type { Schemas } from "../../../api/types";

/** 回合记录里的一个位置：第几回合（下标）、该回合已经有多少条。 */
export interface EntriesSnapshot {
  roundIndex: number;
  count: number;
}

/** 记下"此刻"的记录位置；还没有回合时给 `null`（无处可比）。 */
export function snapshotEntries(rounds: Schemas["Round"][]): EntriesSnapshot | null {
  const round = rounds.at(-1);
  if (round === undefined) {
    return null;
  }
  return { roundIndex: rounds.length - 1, count: round.entries.length };
}

/**
 * 快照之后新增的条目（按发生顺序）。
 *
 * 允许跨回合：一次「过牌」可能同时收掉本回合并开下一回合，新回合的条目也算这次的产出。
 */
export function readEntriesSince(
  rounds: Schemas["Round"][],
  snapshot: EntriesSnapshot | null,
): Schemas["RoundEntry"][] {
  if (snapshot === null) {
    return [];
  }
  const entries: Schemas["RoundEntry"][] = [];
  for (let index = snapshot.roundIndex; index < rounds.length; index += 1) {
    const round = rounds[index];
    if (round === undefined) {
      continue;
    }
    entries.push(...round.entries.slice(index === snapshot.roundIndex ? snapshot.count : 0));
  }
  return entries;
}
