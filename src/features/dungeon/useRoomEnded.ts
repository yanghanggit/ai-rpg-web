import { useCallback, useSyncExternalStore } from "react";
import { endedRoomKey, isRoomEnded, markRoomEnded, subscribeEndedRooms } from "./endedRooms";

/**
 * 本间（按 `room.stage.name`）在客户端"结束过没有"，以及记下它结束的动作。
 *
 * 地图用它决定当前那一行给「进入房间」还是「前往下一间」；房间页的「结束本间」用它记账。
 * 约束见 `endedRooms.ts`。
 */
export function useRoomEnded(userName: string, gameName: string, stageName: string) {
  const key = endedRoomKey(userName, gameName, stageName);
  const ended = useSyncExternalStore(subscribeEndedRooms, () => isRoomEnded(key));
  const markEnded = useCallback(() => markRoomEnded(key), [key]);
  return { ended, markEnded };
}
