import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import Modal from "../../../components/Modal";
import CombatRoundLog from "./CombatRoundLog";
import { COMBAT_RESULT_LABELS, COMBAT_STATE_LABELS } from "./combatPhase";

/** 把后端给的角色名列表拼成一行（原始名过一遍 `displayName`）。空列表显示「—」。 */
function nameList(names: string[]): string {
  return names.length === 0 ? "—" : names.map(displayName).join(" → ");
}

/** 单回合的元数据（行动顺序 / 已完成 / 当前行动 / 动作次数）；日志与叙事交给 `CombatRoundLog`。 */
function RoundFacts({ index, round }: { index: number; round: Schemas["Round"] }) {
  const current = round.current_actor;
  return (
    <>
      <h4>
        第 {index + 1} 回合{" "}
        <span className="muted">
          · {round.is_completed ? "已结束" : "进行中"} ·{" "}
          {round.draw_completed ? "已抓牌" : "未抓牌"}
        </span>
      </h4>
      <dl className="facts">
        <dt>行动顺序</dt>
        <dd>{nameList(round.action_order)}</dd>
        <dt>已完成</dt>
        <dd>{nameList(round.completed_actors)}</dd>
        {current === null || current === undefined ? null : (
          <>
            <dt>当前行动</dt>
            <dd>{displayName(current)}</dd>
          </>
        )}
        <dt>消耗品 / 装备</dt>
        <dd>
          {round.consumable_use_count} / {round.gear_equip_count}
        </dd>
      </dl>
      <CombatRoundLog round={round} />
    </>
  );
}

/**
 * 「战斗信息」浮窗：把战斗的宏观状态与**全部回合**的 `Round` 数据一次列出来
 * （字段对齐 `models/combat.py::Round`），对应 TUI `/round` 的逐回合视角。
 *
 * 由战斗房 ⚙「副本操作」菜单里的「战斗信息」一行打开（`RoomActionsDialog` 回调 → `RoomScaffold`
 * 的 `pane` 切到这层）。战斗的宏观状态原本是战斗页顶部的一排 chip，现在收进菜单里，战斗页本身
 * 只留"现在该做什么"；**初始化 / 回合开始 / 行动 / 结算哪个 phase 都能开**（只依赖战斗数据在不在）。
 *
 * 它自己就是一层浮窗：菜单点它时已经关了菜单再开它（对照 docs/pages.md「同类切换不叠第三层」），
 * 所以这里不需要 `DeckBrowserDialog` 那种关层守卫。
 */
export default function CombatInfoDialog({
  combat,
  onClose,
}: {
  combat: Schemas["Combat"];
  onClose: () => void;
}) {
  return (
    <Modal title="战斗信息" size="lg" onClose={onClose}>
      <dl className="facts">
        <dt>状态</dt>
        <dd>{COMBAT_STATE_LABELS[combat.state] ?? combat.state}</dd>
        <dt>结果</dt>
        <dd>{COMBAT_RESULT_LABELS[combat.result] ?? combat.result}</dd>
        <dt>回合</dt>
        <dd>{combat.rounds.length}</dd>
        {combat.retreated ? (
          <>
            <dt>撤退</dt>
            <dd>已撤退</dd>
          </>
        ) : null}
      </dl>

      <h3>全部回合</h3>
      {combat.rounds.length === 0 ? (
        <p className="muted">（尚无回合记录）</p>
      ) : (
        <ul className="plain">
          {combat.rounds.map((round, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 回合按顺序只追加，永不重排，下标即稳定身份
            <li key={index}>
              <RoundFacts index={index} round={round} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
