import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import ItemRow from "../../items/ItemRow";
import type { Item } from "../../items/types";
import { useAdvanceStage } from "../useAdvanceStage";
import CombatRoster from "./CombatRoster";
import CombatRoundLog from "./CombatRoundLog";
import CombatStatus from "./CombatStatus";
import type { Combatant } from "./readCombat";
import { useCollectLoot } from "./useCollectLoot";

/** 胜负 → 结语与配色。 */
function resultLabel(result: number): { text: string; className: string } {
  if (result === 1) {
    return { text: "🏆 战斗胜利！", className: "ok" };
  }
  if (result === 2) {
    return { text: "💀 战斗失败。", className: "error" };
  }
  return { text: "战斗已结束。", className: "muted" };
}

/**
 * 战斗结算（`COMPLETE / POST_COMBAT`，对应 TUI `CombatPostScreen`）。
 *
 * **结算专属的两件事都由本组件自己持有**（不劳烦父层）：收取战利品（`useCollectLoot`，
 * `LootComponent` → 背包的**同步**接口）与「进入下一关」（`useAdvanceStage`）。父层只把共享快照传进来。
 *
 * 「进入下一关」是**直接一个按钮**推进，不套确认框：战斗结束后的推进没有开场房那种「未初始化」
 * 前置，语义就是「看完结算继续走」；没有下一间时后端 409，错误原样显示（与开场房确认框同一口径）。
 * 「离开副本」属于外层共同框架（顶部动作区），这里不重复。
 *
 * 展示胜负 / 局数 / 参战者（含战死标记）/ 战利品 / 最新回合记录。
 */
export default function CombatPostPanel({
  userName,
  gameName,
  combat,
  combatants,
  combatPending,
  loot,
}: {
  userName: string;
  gameName: string;
  combat: Schemas["Combat"];
  combatants: Combatant[];
  combatPending: boolean;
  loot: Item[];
}) {
  const advance = useAdvanceStage(userName, gameName);
  const collect = useCollectLoot(userName, gameName);
  const latest = combat.rounds.at(-1) ?? null;
  const result = resultLabel(combat.result);
  const collectError = collect.isError ? describeApiError(collect.error) : null;
  const advanceError = advance.isError ? describeApiError(advance.error) : null;

  return (
    <>
      <CombatStatus combat={combat} currentActor={null} />
      <p className={result.className}>{result.text}</p>

      <div className="toolbar">
        <button
          type="button"
          disabled={collect.isPending || loot.length === 0}
          onClick={() => collect.mutate()}
        >
          {collect.isPending ? "收取中…" : `收取战利品（${loot.length}）`}
        </button>
        <button type="button" disabled={advance.isPending} onClick={() => advance.mutate()}>
          {advance.isPending ? "推进中…" : "进入下一关"}
        </button>
      </div>
      {collectError ? <p className="error">收取战利品失败：{collectError}</p> : null}
      {advanceError ? <p className="error">进入下一关失败：{advanceError}</p> : null}

      <section>
        <div className="section-head">
          <h2>战利品</h2>
          {loot.length === 0 ? null : <span className="badge">未收取</span>}
        </div>
        {loot.length === 0 ? (
          <p className="muted">（本场战斗没有战利品，或已收取）</p>
        ) : (
          <ul className="items">
            {loot.map((item) => (
              <ItemRow key={item.uuid === "" ? item.name : item.uuid} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>参战者</h2>
        </div>
        <CombatRoster combatants={combatants} currentActor={null} pending={combatPending} />
      </section>

      <section>
        <div className="section-head">
          <h2>本回合记录</h2>
        </div>
        <CombatRoundLog round={latest} />
      </section>
    </>
  );
}
