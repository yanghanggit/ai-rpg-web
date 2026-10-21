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

/**
 * 战斗房间的四个阶段。`init` 是进房那一屏（一回合都还没开，只出现一次），`round_start` 是
 * **回合之间**（上一回合已结束 / 新回合还没抓牌）——后者是行动面板的子状态，不换屏。
 */
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

/**
 * 由战斗状态派生当前 phase。
 *
 * 判据是**有没有回合**而不是 `state`：`state` 在进房后马上变成 ONGOING（初始化任务一落地），
 * 但「一回合都还没开」仍是进房那一屏。回合只增不减，所以 `init` 一场战斗只出现一次。
 */
export function deriveCombatPhase(combat: Combat): CombatPhase {
  if (combat.state === COMBAT_STATE.COMPLETE || combat.state === COMBAT_STATE.POST_COMBAT) {
    return "post";
  }
  // NONE / INITIALIZATION / 已初始化但还没抓过牌：进房那一屏
  if (combat.rounds.length === 0) {
    return "init";
  }
  // 尚未抓牌、回合已结束、无行动角色 → 回合之间
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
