import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import ItemRow from "../../items/ItemRow";
import type { Item } from "../../items/types";
import CombatRoster from "./CombatRoster";
import CombatRoundLog from "./CombatRoundLog";
import CombatStatus from "./CombatStatus";
import { COMBAT_RESULT } from "./combatPhase";
import type { Combatant } from "./readCombat";
import { useCollectLoot } from "./useCollectLoot";

/** 胜负 → 结语与配色。 */
function resultLabel(result: number): { text: string; className: string } {
  if (result === COMBAT_RESULT.WIN) {
    return { text: "🏆 战斗胜利！", className: "ok" };
  }
  if (result === COMBAT_RESULT.LOSE) {
    return { text: "💀 战斗失败。", className: "error" };
  }
  return { text: "战斗已结束。", className: "muted" };
}

/**
 * 战斗结算（`COMPLETE / POST_COMBAT`，对应 TUI `CombatPostScreen`）。
 *
 * **结算专属的两件事都由本组件自己持有**（不劳烦父层）：收取战利品（`useCollectLoot`，
 * `LootComponent` → 背包的**同步**接口）与父层透传进来的「结束本次战斗」。
 *
 * **本间的结束动作不推进副本、也不套确认框**：它只是回地图（`onFinishRoom`），推进是在地图上
 * 才发生的事（「前往下一间」，那里有确认框，因为推进不可逆）。所以这里"结束就是结束"，
 * 零服务端调用。「离开副本」属于外层共同框架（顶部动作区），这里不重复。
 *
 * **单向门**：结束即回地图，而已结束的房间进不去，所以没收的战利品就留在身上拿不到了
 * （`collect_loot` 要求当前房间还是这间战斗房）——只**提示不阻止**（惩罚是设计要的）。
 *
 * 展示胜负 / 局数 / 参战者（含战死标记）/ 战利品 / 最新回合记录。
 *
 * 阶段判据说明：本面板管 `COMPLETE / POST_COMBAT` 两态（对应 TUI 的 `CombatPostScreen`），
 * 而`POST_COMBAT` 才是服务端的"战斗已结束"（`is_post_combat`，推进与离开副本的前置）。
 * `COMPLETE` 只是同一轮 pipeline 里的瞬态（`CombatPostCombatTransitionSystem` 紧跟
 * `CombatOutcomeSystem`），web 实际上观察不到，所以这里不需要额外区分两态。
 */
export default function CombatPostPanel({
  userName,
  gameName,
  combat,
  combatants,
  combatPending,
  loot,
  onFinishRoom,
}: {
  userName: string;
  gameName: string;
  combat: Schemas["Combat"];
  combatants: Combatant[];
  combatPending: boolean;
  loot: Item[];
  /** 本间的结束动作：回地图（由页面接线，本层不认识路由）。 */
  onFinishRoom: () => void;
}) {
  const collect = useCollectLoot(userName, gameName);
  const latest = combat.rounds.at(-1) ?? null;
  const result = resultLabel(combat.result);
  const collectError = collect.isError ? describeApiError(collect.error) : null;

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
        {/* 本间的结束动作：回地图。之后本间进不来，没收拾的就没机会了 */}
        <button type="button" onClick={onFinishRoom}>
          结束本次战斗
        </button>
      </div>
      {collectError ? <p className="error">收取战利品失败：{collectError}</p> : null}
      {loot.length === 0 ? null : (
        <p className="muted">还有战利品未收取：结束本间后就无法再收了。</p>
      )}

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
