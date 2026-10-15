/**
 * 战斗房间的 phase 派生（纯函数）。
 */
import type { Schemas } from "../../../api/types";

type Combat = Schemas["Combat"];

/** 与后端 `CombatState` 对应（schema 只生成裸数字联合）。 */
export const COMBAT_STATE = {
  NONE: 0,
  INITIALIZATION: 1,
  ONGOING: 2,
  COMPLETE: 3,
  POST_COMBAT: 4,
} as const;

/** 战斗房间的四个阶段。 */
export type CombatPhase = "init" | "round_start" | "turn" | "post";

/** 与后端 `CombatResult` 对应；`state` 说进行到哪步，`result` 说谁赢了。 */
export const COMBAT_RESULT = {
  NONE: 0,
  WIN: 1,
  LOSE: 2,
} as const;

export const COMBAT_STATE_LABELS: Record<number, string> = {
  [COMBAT_STATE.NONE]: "未开始",
  [COMBAT_STATE.INITIALIZATION]: "初始化中",
  [COMBAT_STATE.ONGOING]: "进行中",
  [COMBAT_STATE.COMPLETE]: "已分出胜负",
  [COMBAT_STATE.POST_COMBAT]: "结算中",
};

/** 战斗结果 → 界面说法。 */
export const COMBAT_RESULT_LABELS: Record<number, string> = {
  [COMBAT_RESULT.NONE]: "—",
  [COMBAT_RESULT.WIN]: "胜利",
  [COMBAT_RESULT.LOSE]: "失败",
};

/** 由战斗状态派生当前 phase。 */
export function deriveCombatPhase(combat: Combat): CombatPhase {
  if (combat.state === COMBAT_STATE.COMPLETE || combat.state === COMBAT_STATE.POST_COMBAT) {
    return "post";
  }
  // NONE / INITIALIZATION：还没开打，等待初始化
  if (combat.state !== COMBAT_STATE.ONGOING) {
    return "init";
  }
  // 无回合、尚未抓牌、回合已结束、无行动角色 → round_start
  const latest = combat.rounds.at(-1);
  if (
    latest === undefined ||
    !latest.draw_completed ||
    latest.is_completed ||
    latest.current_actor === null ||
    latest.current_actor === undefined
  ) {
    return "round_start";
  }
  return "turn";
}
