import type { Schemas } from "../../../api/types";

/** 操作类型 → 界面说法（与后端 `RoundEntryKind` 对应）。 */
const ENTRY_KIND_LABELS: Record<Schemas["RoundEntry"]["kind"], string> = {
  cards: "出牌结算",
  consumable: "消耗品",
  gear: "装备",
  artifact: "神器",
  autonomous: "自主运行",
  failed: "结算未完成",
};

/**
 * 一批回合条目：种类说法 + 数据日志 + 叙事，按数组顺序线性列出（只追加、不重排）。
 *
 * 本回合全量（`CombatRoundLog`）与"这次动作新增的几条"（`ActionReportDialog`）共用这一份。
 */
export function RoundEntryList({ entries }: { entries: Schemas["RoundEntry"][] }) {
  return (
    <ul className="plain">
      {entries.map((entry, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 战斗记录只追加、永不重排，下标即稳定身份
        <li key={index}>
          <h4>{ENTRY_KIND_LABELS[entry.kind]}</h4>
          <p>{entry.log}</p>
          <p className="muted">{entry.narrative}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * 本回合记录：最新回合的整条队列。
 *
 * 这是**本回合**的明细，与「叙事」那份全局事件流不是同一份数据。
 */
export default function CombatRoundLog({ round }: { round: Schemas["Round"] | null }) {
  if (round === null) {
    return <p className="muted">（尚无回合记录）</p>;
  }
  if (round.entries.length === 0) {
    return <p className="muted">（本回合暂无战斗记录）</p>;
  }

  return <RoundEntryList entries={round.entries} />;
}
