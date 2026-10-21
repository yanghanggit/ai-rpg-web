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
 * 本回合记录：把最新回合的记录队列按**发生顺序线性**列出（整体刷新）。
 *
 * 每条记录自带 `log` + `narrative`，队列跨类型保序，依序渲染即可。这是**本回合**的明细，
 * 与「叙事」那份全局事件流不是同一份数据。
 */
export default function CombatRoundLog({ round }: { round: Schemas["Round"] | null }) {
  if (round === null) {
    return <p className="muted">（尚无回合记录）</p>;
  }
  if (round.entries.length === 0) {
    return <p className="muted">（本回合暂无战斗记录）</p>;
  }

  return (
    <ul className="plain">
      {round.entries.map((entry, index) => (
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
