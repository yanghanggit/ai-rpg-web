import type { Schemas } from "../../../api/types";

/** 操作类型 → 界面说法（与后端 `RoundEntryKind` 对应）。 */
const ENTRY_KIND_LABELS: Record<Schemas["RoundEntry"]["kind"], string> = {
  cards: "出牌",
  consumable: "消耗品",
  gear: "装备",
  artifact: "神器",
};

/**
 * 本回合记录：把最新回合的记录队列按**发生顺序线性**列出（整体刷新）。
 *
 * 每条记录自带 `log`（战斗数据）+ `narrative`（演出叙事），队列跨类型保序，
 * 因此直接依序渲染即可，无需再按类型分组或对齐两条并行数组。
 *
 * 这是**本回合**的明细，与顶栏「叙事」按钮打开的**全局**事件流不是同一份数据，
 * 所以这里不重复搬运会话消息。
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
