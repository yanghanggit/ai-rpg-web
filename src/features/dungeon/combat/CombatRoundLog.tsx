import type { Schemas } from "../../../api/types";

function LogSection({
  title,
  logs,
  narratives,
}: {
  title: string;
  logs: string[];
  narratives: string[];
}) {
  if (logs.length === 0 && narratives.length === 0) {
    return null;
  }
  // 日志与叙事是两条并行数组（同一次动作各追一条），按较长的一条对齐渲染
  const count = Math.max(logs.length, narratives.length);
  return (
    <>
      <h3>{title}</h3>
      <ul className="plain">
        {Array.from({ length: count }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 战斗记录是只追加的有序日志，永不重排，下标即稳定身份
          <li key={index}>
            {logs[index] ? <p>{logs[index]}</p> : null}
            {narratives[index] ? <p className="muted">{narratives[index]}</p> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * 本回合记录：把最新回合的「战斗日志 + 叙事」常驻在回合行动 / 结算页里（整体刷新，
 * 不做 TUI 那种「只 diff 本次新增」的增量展示）。
 *
 * 这是**本回合**的明细，与顶栏「叙事」按钮打开的**全局**事件流不是同一份数据，
 * 所以这里不重复搬运会话消息。分节顺序与 TUI `/round` 一致。
 */
export default function CombatRoundLog({ round }: { round: Schemas["Round"] | null }) {
  if (round === null) {
    return <p className="muted">（尚无回合记录）</p>;
  }

  const sections = [
    { title: "出牌", logs: round.cards_log, narratives: round.cards_narrative },
    { title: "消耗品", logs: round.consumable_log, narratives: round.consumable_narrative },
    { title: "装备", logs: round.gear_log, narratives: round.gear_narrative },
    { title: "神器", logs: round.artifact_log, narratives: round.artifact_narrative },
  ];
  const hasAny = sections.some(
    (section) => section.logs.length > 0 || section.narratives.length > 0,
  );
  if (!hasAny) {
    return <p className="muted">（本回合暂无战斗记录）</p>;
  }

  return (
    <>
      {sections.map((section) => (
        <LogSection key={section.title} {...section} />
      ))}
    </>
  );
}
