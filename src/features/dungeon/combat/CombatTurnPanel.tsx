import { useState } from "react";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import CardItem from "../../cards/CardItem";
import CombatRoster from "./CombatRoster";
import CombatRoundLog from "./CombatRoundLog";
import CombatStatus from "./CombatStatus";
import type { Combatant } from "./readCombat";
import type { CombatActions } from "./useCombatActions";

/**
 * 单个角色的回合行动（`ONGOING` 且有 `current_actor`，对应 TUI `CombatTurnActorScreen`）。
 *
 * 按当前 turn 角色的阵营分两套操作（与 TUI 的 `_command_defs_for_faction` 同一开关）：
 * - 我方：手牌逐张「出牌」（非自身牌先选目标），另有「过牌」结束本角色回合；
 * - 怪物：「推进怪物回合」，由服务端自动出牌 / 过牌。
 *
 * 目标选择放在手牌卡面上（`CardItem` 的 `action` 插槽）：服务端 `resolve_targets` 要求
 * 非 `self_target` 牌**恰好一个目标**作为锚点，所以每张牌自带一个目标下拉。自身牌不需要目标。
 *
 * `play / use / gear` 不推进行动权，`pass`/怪物推进才结束回合；本页不预判换手——
 * 动作成功后失效刷新、`CombatRoomPanel` 重新派生 phase 自然会切到下一页。
 */
export default function CombatTurnPanel({
  combat,
  combatants,
  currentActor,
  combatPending,
  actions,
}: {
  combat: Schemas["Combat"];
  combatants: Combatant[];
  currentActor: string | null;
  combatPending: boolean;
  actions: CombatActions;
}) {
  const [targets, setTargets] = useState<Record<string, string>>({});

  const latest = combat.rounds.at(-1) ?? null;
  const current = combatants.find((combatant) => combatant.name === currentActor) ?? null;

  // 可被选为目标：所有存活者（治疗牌可能指向友方，攻击牌指向怪物，交给服务端校验）
  const alive = combatants.filter((combatant) => !combatant.dead);
  const defaultTarget = (alive.find((c) => c.faction === "monster") ?? alive[0])?.name ?? "";

  const actionError =
    actions.play.error ??
    actions.advance.error ??
    actions.pass.error ??
    actions.use.error ??
    actions.gear.error;

  return (
    <>
      <CombatStatus combat={combat} currentActor={currentActor} />

      <section>
        <div className="section-head">
          <h2>参战者</h2>
        </div>
        <CombatRoster combatants={combatants} currentActor={currentActor} pending={combatPending} />
      </section>

      <section className="combat-turn">
        <div className="section-head">
          <h2>回合行动</h2>
        </div>

        {current === null ? (
          <p className="error">找不到当前行动角色：{currentActor ?? "（无）"}</p>
        ) : current.faction === "monster" ? (
          <>
            <p className="muted">
              当前由 {displayName(current.name)} 行动，点击下方按钮让 AI 自动出牌或过牌。
            </p>
            <div className="toolbar">
              <button
                type="button"
                disabled={actions.isBusy}
                onClick={() => actions.advance.start(current.name)}
              >
                {actions.advance.isBusy ? "推进中…" : "推进怪物回合"}
              </button>
            </div>
          </>
        ) : (
          <>
            <ul className="chips">
              <li className="chip">行动者：{displayName(current.name)}</li>
              <li className="chip">能量 {current.energy}</li>
              <li className="chip">格挡 {current.block}</li>
              {current.stats === null ? null : (
                <li className="chip">
                  HP {current.stats.hp}/{current.stats.max_hp}
                </li>
              )}
            </ul>

            <h3>手牌</h3>
            {current.hand.length === 0 ? (
              <p className="muted">（手牌为空）</p>
            ) : (
              <ul className="card-tiles">
                {current.hand.map((card) => {
                  const chosen = targets[card.uuid] ?? defaultTarget;
                  const playTargets = card.self_target ? [current.name] : [chosen];
                  return (
                    <CardItem
                      key={card.uuid}
                      card={card}
                      action={
                        <span className="combat-hand-actions">
                          {card.self_target ? null : (
                            <label className="muted">
                              目标{" "}
                              <select
                                aria-label={`${card.name} 的目标`}
                                value={chosen}
                                disabled={actions.isBusy}
                                onChange={(event) =>
                                  setTargets((prev) => ({
                                    ...prev,
                                    [card.uuid]: event.target.value,
                                  }))
                                }
                              >
                                {alive.map((target) => (
                                  <option key={target.name} value={target.name}>
                                    {displayName(target.name)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <button
                            type="button"
                            disabled={actions.isBusy || (!card.self_target && chosen === "")}
                            onClick={() => actions.play.start(current.name, card.name, playTargets)}
                          >
                            {card.self_target ? "出牌（自身）" : "出牌"}
                          </button>
                        </span>
                      }
                    />
                  );
                })}
              </ul>
            )}

            <div className="toolbar">
              <button
                type="button"
                disabled={actions.isBusy}
                onClick={() => actions.pass.start(current.name)}
              >
                {actions.pass.isBusy ? "过牌中…" : "过牌（结束回合）"}
              </button>
            </div>
          </>
        )}

        {actionError ? <p className="error">回合动作失败：{actionError}</p> : null}
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
