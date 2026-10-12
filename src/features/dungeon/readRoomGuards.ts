import type { Schemas } from "../../api/types";
import { COMBAT_RESULT, COMBAT_STATE } from "./combat/combatPhase";

/**
 * 本房间自身的状态判据（纯函数）：`done` 干活儿干完了没有，`defeated` 打输了没有。
 * 能不能推进 / 离开副本由服务端判，这里不做镜像。
 */
export function readRoomGuards(room: Schemas["DungeonRoomResponse"]["room"]) {
  if (room.type === "opening") {
    return { done: room.initialized, defeated: false };
  }

  const { state, result } = room.combat;
  const done = state === COMBAT_STATE.POST_COMBAT;
  return { done, defeated: done && result === COMBAT_RESULT.LOSE };
}
