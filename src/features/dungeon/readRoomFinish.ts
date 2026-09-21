import type { Schemas } from "../../api/types";
import { readNextRoom } from "./readNextRoom";

/** 「结束本间」之后去哪儿：一份文案 + 一个去处，供标题行那颗图标与正文的卡片共用。 */
export interface RoomFinish {
  /** 括号里的去向（「回到地图」/「离开副本」）——两个房间页各自的动作名不同，去向是同一个。 */
  caption: string;
  /** 去向的长说明（进 `title`；有"还有东西没拿"时会被那句提醒替换掉）。 */
  hint: string;
  /** 结束本间就离开整局副本回家园——调用方据此改成 `exit.start()`，否则去地图。 */
  leavesRun: boolean;
}

/**
 * 「结束本间」结束之后去哪儿。
 *
 * - 还有下一间 → **房间之间**（地图）：前进那一步在那边点，那是唯一能改变队伍位置的地方；
 * - 本间之后没有房间了、或**打输了** → 直接离开副本回家园（服务端 `advance_stage` 在这两种情况下
 *   必然拒绝，终点只能落在整局唯一的出口上）。
 *
 * **两个房间页共用这一份**：它们是同一件事的两种房间说法（「结束开局准备」/「结束本次战斗」），
 * 去向与措辞再抄一份，迟早会分叉成两种说法。
 *
 * `state` 就直接收 `useDungeonRun().data`——**故意收原始查询数据**，因为"还没回来"与"副本里没有
 * 下一间"是两件不同的事：前者按"还有下一间"处理（地图那一屏对"没有可前往的房间"有兜底文案，指回
 * 「离开副本」），后者才是真的该走了。这个亚秒级窗口因此不会把人带错地方。
 */
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
