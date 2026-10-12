import type { Schemas } from "../../api/types";

/** `Dungeon.rooms` 的元素类型（开场房 / 战斗房的联合）。 */
export type DungeonRoom = Schemas["Dungeon"]["rooms"][number];

/** 队伍接下来能走进的那一间；没有进行中的副本或已是最后一间 → `null`。 */
export function readNextRoom(dungeon: Schemas["Dungeon"] | null): DungeonRoom | null {
  if (dungeon === null) {
    return null;
  }
  return dungeon.rooms[dungeon.current_room_index + 1] ?? null;
}
