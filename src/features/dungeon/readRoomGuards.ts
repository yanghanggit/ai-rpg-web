import type { Schemas } from "../../api/types";
import { COMBAT_RESULT, COMBAT_STATE } from "./combat/combatPhase";

/**
 * 本房间自身的状态判据（纯函数）：`done` 干活儿干完了没有，`defeated` 打输了没有。
 * 能不能推进 / 离开副本由服务端判，这里不做镜像。
 *
 * 战斗房间的 `done` 来自服务端（`combat.state === POST_COMBAT`）；开场房没有这个字段，
 * 由调用方把客户端记账传进来（`endedRooms.ts`）。
 */
export function readRoomGuards(
  room: Schemas["DungeonRoomResponse"]["room"],
  endedByClient = false,
) {
  if (room.type === "opening") {
    // 开场房没有完成态：只有「客户端结束过没有」这一件事。不结束直接推进也允许（服务端不拦）。
    return { done: endedByClient, defeated: false };
  }

  const { state, result } = room.combat;
  const done = state === COMBAT_STATE.POST_COMBAT;
  return { done, defeated: done && result === COMBAT_RESULT.LOSE };
}
