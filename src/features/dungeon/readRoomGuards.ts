import type { Schemas } from "../../api/types";
import { COMBAT_RESULT, COMBAT_STATE } from "./combat/combatPhase";

/**
 * 本房间自身的状态判据（纯函数）：`done` 干活儿干完了没有，`defeated` 打输了没有。
 * 能不能推进 / 离开副本由服务端判，这里不做镜像。
 */
export function readRoomGuards(room: Schemas["DungeonRoomResponse"]["room"]) {
  if (room.type === "opening") {
    // 非战斗房间没有“完成”状态（叙事 / 奖励都挂在实体上，服务端也不据此拦截推进）：随时可离开
    return { done: true, defeated: false };
  }

  const { state, result } = room.combat;
  const done = state === COMBAT_STATE.POST_COMBAT;
  return { done, defeated: done && result === COMBAT_RESULT.LOSE };
}
