import type { Schemas } from "../../../api/types";
import CombatRoster from "./CombatRoster";
import type { Combatant } from "./readCombat";

/**
 * 回合开始 + 抓牌（`ONGOING` 且需要抓牌，对应 TUI `CombatRoundStartScreen`）。
 *
 * 抓牌是玩家的**主动决策**，所以给一个显式按钮，不自动触发；开新回合与填手牌是同一个动作。
 * 何时落在这里由 `deriveCombatPhase` 决定：无回合 / 尚未抓牌 / 回合已结束。
 */
export default function CombatRoundStartPanel({
  combat,
  combatants,
  currentActor,
  combatPending,
  onDraw,
  drawBusy,
  drawError,
}: {
  combat: Schemas["Combat"];
  combatants: Combatant[];
  currentActor: string | null;
  combatPending: boolean;
  onDraw: () => void;
  drawBusy: boolean;
  drawError: string | null;
}) {
  const latest = combat.rounds.at(-1) ?? null;
  // 第一回合（还没有任何回合记录）不写引导句：按钮本身就是唯一动作，不靠文字再说一遍。
  const hint =
    latest === null
      ? null
      : latest.is_completed
        ? "本回合已全部行动完毕，抓牌以开启新回合。"
        : "本回合尚未抓牌。";

  return (
    <>
      {hint === null ? null : <p className="muted">{hint}</p>}

      <div className="toolbar">
        <button type="button" disabled={drawBusy} onClick={onDraw}>
          {drawBusy ? "抓牌中…" : "抓牌（开启新回合）"}
        </button>
      </div>
      {drawError ? <p className="error">抓牌失败：{drawError}</p> : null}

      <section>
        <div className="section-head">
          <h2>参战者</h2>
        </div>
        <CombatRoster combatants={combatants} currentActor={currentActor} pending={combatPending} />
      </section>
    </>
  );
}
