import type { Schemas } from "../../api/types";
import { COMBAT_RESULT, COMBAT_STATE } from "./combat/combatPhase";

/**
 * 房间侧的服务端前置条件（纯函数，无 React / 网络）——**镜像**服务端两处的房间检查：
 * - `services/dungeon_advance_action.py`：能不能推进下一间（开场房看 `initialized`，战斗房看
 *   `is_post_combat`，战斗失败与没有下一间都不能推）；
 * - `services/dungeon_exit_action.py`：能不能离开副本（开场房未初始化时拦）。
 *
 * **为什么要镜像**：地图页必须能表达「下一间现在能不能点」，否则无从禁用 / 说明。
 * 口径只用于**禁用与说明**，绝不替代后端校验——点下去后端仍会重新判一次，失败原因原样显示。
 * 这与开场房间一直以来的 `exitBlocked` 是同一条原则（见 docs/pages.md）。
 *
 * 三处刻意的精确（写错就会“看着能点、点了被拒”）：
 * - **战斗的「已结束」只认 `state === POST_COMBAT`，不是 `combatPhase === "post"`**：
 *   `combatPhase` 把 `COMPLETE` 也算进 `post`，比服务端的 `is_post_combat` 宽。
 *   （`COMPLETE` 是同一轮 pipeline 内的瞬态：`CombatPostCombatTransitionSystem` 紧跟在
 *   `CombatOutcomeSystem` 后面，所以 web 实际上观察不到它——但判据仍要与服务端一字不差。）
 * - **战斗失败不能推进**（服务端的 `is_lost` 分支），此时唯一的出路是离开副本。
 * - **离开副本只前置禁用确定已知的那一种**（开场房未初始化）；战斗未结束那条**不预判**，
 *   由后端在任务里拦——所以战斗房间永远返回 `exitBlocked: false`。
 *
 * 「没有下一间（副本已全部通关）」不在这里：那是「副本整局」的判断，属于地图页（它手里有
 * `/state` 的完整房间表），不属于「这一个房间」。
 */
export function readRoomGuards(room: Schemas["DungeonRoomResponse"]["room"]) {
  if (room.type === "opening") {
    const initialized = room.initialized;
    return {
      /** 本房间是否已结束：服务端推进的房间侧前置（也是「本间的活儿干完了」）。 */
      done: initialized,
      /** 未结束时给玩家看的原因（与服务端同一句话）。 */
      pendingReason: initialized ? null : "开场房间尚未初始化，无法推进",
      /** 战斗已失败：只能离开副本，不能推进（开场房恒为 false）。 */
      defeated: false,
      /** 「离开副本」是否**前置禁用**。 */
      exitBlocked: !initialized,
      /** 禁用「离开副本」时写给玩家的原因。 */
      exitBlockedHint: initialized
        ? null
        : "开场房间尚未初始化：先完成初始化（进房间会自动跑，失败可重试），才能结束本间或离开副本。",
    };
  }

  const { state, result } = room.combat;
  const done = state === COMBAT_STATE.POST_COMBAT;
  return {
    done,
    pendingReason: done ? null : "战斗未结束，无法推进",
    defeated: done && result === COMBAT_RESULT.LOSE,
    exitBlocked: false,
    exitBlockedHint: null,
  };
}
