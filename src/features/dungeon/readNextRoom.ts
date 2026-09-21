import type { Schemas } from "../../api/types";

/** `Dungeon.rooms` 的元素类型（开场房 / 战斗房的联合）。 */
export type DungeonRoom = Schemas["Dungeon"]["rooms"][number];

/**
 * 队伍接下来能走进的那一间（`rooms[current_room_index + 1]`）。
 *
 * **为什么值得单独一个读取器**：「还有没有下一间」是两个地方都要问的问题，而且答案决定行为——
 * - **房间页**：本间结束后还有下一间 → 去地图（队伍的位置只在那里改变）；
 *   没有（或打输了）→ 直接离开副本回家园（服务端 `advance_stage` 在最后一间必然 409「副本已全部通关」，
 *   所以那一步没有别的可能）；
 * - **地图**：前进的目标就是这一间。今天它是**唯一**候选——将来地图变成"选路"（多个候选）时，
 *   这里就是那个"候选集"长出来的地方。
 *
 * 没有进行中的副本（`null`）或已经是最后一间 → `null`。
 */
export function readNextRoom(dungeon: Schemas["Dungeon"] | null): DungeonRoom | null {
  if (dungeon === null) {
    return null;
  }
  return dungeon.rooms[dungeon.current_room_index + 1] ?? null;
}
