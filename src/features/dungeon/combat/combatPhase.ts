/**
 * 战斗房间的 phase 派生（纯函数，无 React / 网络）。
 *
 * web 端与 TUI 的结构差异：TUI 是「一个 Screen 一个阶段、靠 `switch_screen` 换屏」；
 * web 端 `CombatRoomPage` 每次渲染都持有最新的 `room.combat`，所以**从状态派生当前阶段**
 * 即可，不需要复刻 TUI 的「锁输入 → 回车 → 切屏」。动作成功后失效查询 → `/room` 重取 →
 * phase 重新派生 → 自动落到下一个 Panel。
 *
 * 四个 phase 与 TUI 的四个 Screen 一一对应（便于对照维护）：
 * - `init`        ↔ `combat_init.py`（NONE / INITIALIZATION，等待初始化）
 * - `round_start` ↔ `combat_round_start.py`（ONGOING，开新回合 + 抓牌）
 * - `turn`        ↔ `combat_turn_actor.py`（ONGOING，当前角色行动）
 * - `post`        ↔ `combat_post.py`（COMPLETE / POST_COMBAT，结算）
 *
 * 判据集中在这里一份，Panel 只消费结果；TUI 的 `_detect_transition`（「本动作是否结束回合」）
 * 在 web 里退化成「数据变了，派生结果就变了」，不用显式写转移逻辑。
 */
import type { Schemas } from "../../../api/types";

type Combat = Schemas["Combat"];

/**
 * 战斗状态枚举值，与后端 `models/combat.py::CombatState` 一一对应。
 *
 * `schema.d.ts` 只生成成裸的 `0 | 1 | 2 | 3 | 4` 联合，这里补一份命名，避免散落的魔法数字。
 */
export const COMBAT_STATE = {
  NONE: 0,
  INITIALIZATION: 1,
  ONGOING: 2,
  COMPLETE: 3,
  POST_COMBAT: 4,
} as const;

/** 战斗房间的四个阶段。 */
export type CombatPhase = "init" | "round_start" | "turn" | "post";

/**
 * 战斗结果枚举值，与后端 `models/combat.py::CombatResult` 一一对应（同样是裸数字联合）。
 *
 * 它和 `state` 是两件事：`state` 说“进行到哪一步”，`result` 说“谁赢了”。
 * 服务端的 `is_won` / `is_lost` 就读它，所以 `readRoomGuards` 与结算面板都从这里取。
 */
export const COMBAT_RESULT = {
  NONE: 0,
  WIN: 1,
  LOSE: 2,
} as const;

/** 战斗状态 → 界面说法（与 TUI `/info` 的 `CombatState.name` 对应）。 */
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
  // 结算阶段：COMPLETE（已出胜负，待结算）与 POST_COMBAT（可收战利品 / 推进）合并，
  // 与 TUI 的 `CombatPostScreen` 同时管这两态一致。
  if (combat.state === COMBAT_STATE.COMPLETE || combat.state === COMBAT_STATE.POST_COMBAT) {
    return "post";
  }
  // NONE / INITIALIZATION：战斗还没开打，等待（自动）初始化。
  if (combat.state !== COMBAT_STATE.ONGOING) {
    return "init";
  }
  // ONGOING：以最新回合的进度定位。需要抓牌（无回合 / 尚未抓牌 / 回合已结束）
  // 或没有行动角色时，都回到 round_start。
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
