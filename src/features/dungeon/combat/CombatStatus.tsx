import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import { COMBAT_STATE } from "./combatPhase";

/** 战斗状态 → 界面说法（与 TUI `/info` 的 `CombatState.name` 对应）。 */
const STATE_LABELS: Record<number, string> = {
  [COMBAT_STATE.NONE]: "未开始",
  [COMBAT_STATE.INITIALIZATION]: "初始化中",
  [COMBAT_STATE.ONGOING]: "进行中",
  [COMBAT_STATE.COMPLETE]: "已分出胜负",
  [COMBAT_STATE.POST_COMBAT]: "结算中",
};

const RESULT_LABELS: Record<number, string> = { 0: "—", 1: "胜利", 2: "失败" };

/**
 * 战斗宏观状态：状态 / 结果 / 局数 / 当前 turn。
 *
 * 用一排 chip 而不是 `.facts` 名值对：这是战斗页顶部的**常驻摘要**，三个 phase 都要显示，
 * 越紧凑越好。真正的明细（血量 / 手牌 / 牌堆）交给 `CombatRoster` 与回合行动区。
 */
export default function CombatStatus({
  combat,
  currentActor,
}: {
  combat: Schemas["Combat"];
  currentActor: string | null;
}) {
  return (
    <ul className="chips">
      <li className="chip">状态：{STATE_LABELS[combat.state] ?? combat.state}</li>
      <li className="chip">结果：{RESULT_LABELS[combat.result] ?? combat.result}</li>
      <li className="chip">第 {combat.rounds.length} 回合</li>
      {combat.retreated ? <li className="chip">已撤退</li> : null}
      {currentActor === null ? null : <li className="chip">当前：{displayName(currentActor)}</li>}
    </ul>
  );
}
