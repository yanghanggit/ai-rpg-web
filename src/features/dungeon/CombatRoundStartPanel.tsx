import type { Schemas } from "../../api/types";
import CombatRoster from "./CombatRoster";
import CombatStatus from "./CombatStatus";
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
  const hint =
    latest === null
      ? "战斗已开始，抓牌以开启第一回合。"
      : latest.is_completed
        ? "本回合已全部行动完毕，抓牌以开启新回合。"
        : "本回合尚未抓牌。";

  return (
    <>
      <CombatStatus combat={combat} currentActor={currentActor} />
      <p className="muted">{hint}</p>

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
