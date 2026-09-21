import type { Schemas } from "../../api/types";
import { COMBAT_RESULT, COMBAT_STATE } from "./combat/combatPhase";

/**
 * 本房间的**状态判据**（纯函数，无 React / 网络）：本间结束了没有、打输了没有。
 *
 * **它不是服务端规则的镜像**——"能不能推进 / 能不能离开副本"一律由服务端在接口里判，客户端
 * 不预先替它决定（`dungeon_advance_action.py` / `dungeon_exit_action.py` 的前置检查只有那两处
 * 实现）。客户端只用这里的两条，都是**本间状态自身**的事实：
 * - `done`：本间的活儿干完了没有（开场房 = 已初始化，战斗房 = 已结算）。它决定**本间的主行动长
 *   什么样**（`RoomScaffold` 那颗图标）：没干完就是"把本间跑起来 / 重试"，干完了才是"结束本间"；
 * - `defeated`：战斗打输了。打输之后没有"下一间"可去，所以结束本间 = 直接离开副本。
 *
 * **「离开副本」不再有客户端前置禁用**：它是个例外动作（放弃整局），点下去由服务端拦，被拒的原因
 * 原样显示在页面上（`dungeon_exit_action.py` 三种情形都有现成的话：尚未进入房间 / 战斗未结束 /
 * 开场房间尚未初始化）。所以既不写镜像、也不写解释性提示——那句话只能比服务端更早或更晚地
 * 说同一件事。
 *
 * 一处刻意的精确：**战斗的「已结束」只认 `state === POST_COMBAT`，不是 `combatPhase === "post"`**。
 * `combatPhase` 把 `COMPLETE` 也算进 `post`，比服务端的 `is_post_combat` 宽（`COMPLETE` 是同一轮
 * pipeline 内的瞬态：`CombatPostCombatTransitionSystem` 紧跟在 `CombatOutcomeSystem` 后面，web
 * 实际上观察不到它）。
 */
export function readRoomGuards(room: Schemas["DungeonRoomResponse"]["room"]) {
  if (room.type === "opening") {
    return {
      /** 本房间是否已结束：开场房的活儿是"初始化"（叙事 + 牌库）。 */
      done: room.initialized,
      /** 战斗已失败（开场房恒为 false）。 */
      defeated: false,
    };
  }

  const { state, result } = room.combat;
  const done = state === COMBAT_STATE.POST_COMBAT;
  return {
    done,
    /** 输了就没有"下一间"：唯一的去处是离开副本。 */
    defeated: done && result === COMBAT_RESULT.LOSE,
  };
}
