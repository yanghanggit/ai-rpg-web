import type { Schemas } from "../../api/types";
import { readNextRoom } from "./readNextRoom";

/** 「结束本间」的去向：文案 + 是否离开整局，两个房间页共用。 */
export interface RoomFinish {
  /** 括号里的去向（「回到地图」/「离开副本」）。 */
  caption: string;
  /** 去向的长说明（进 `title`；有未领奖励时会被提醒替换）。 */
  hint: string;
  /** `true` 时调用方改成 `exit.start()`，否则去地图。 */
  leavesRun: boolean;
}

/** 还有下一间 → 去地图；没有了或打输了 → 离开副本。 */
export function readRoomFinish(
  state: Schemas["DungeonStateResponse"] | undefined,
  defeated: boolean,
): RoomFinish {
  const finishesRun = state !== undefined && readNextRoom(state.dungeon) === null;
  if (!finishesRun && !defeated) {
    return { caption: "回到地图", hint: "本间结束后进不来。", leavesRun: false };
  }
  return {
    caption: "离开副本",
    hint: defeated ? "战斗失败，只能离开副本回家园。" : "这是最后一间，结束后离开副本回家园。",
    leavesRun: true,
  };
}
