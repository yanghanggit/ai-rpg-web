import type { Schemas } from "../../api/types";

/** 把 ISO 时间压成 `YYYY-MM-DD HH:MM`（本地时区）；解析不了原样返回，缺失返回 `null`。 */
function formatCreatedAt(value: string | undefined): string | null {
  if (value === undefined || value === "") {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 把副本的模型数据整理成浮窗好渲染的形状。
 *
 * 数据本身就是生成物类型（`Schemas["Dungeon"]`），所以这里不做校验，只做三件展示层的事：
 * - 房间类型直接用判别字段 `room.type`（不学 TUI 用「场景里有没有怪物」去猜）；
 * - 敌人从 `room.stage.actors` 里按 `ActorType === "Monster"` 取；
 * - 进度直接读模型自己的 `current_room_index`——**副本进行中时它 >= 0**，静态副本（磁盘
 *   JSON）恒为 -1，所以同一个浮窗给总览页与房间页用都不会误标。
 */

/**
 * 房间类型（判别字段 `room.type`）→ 界面说法。未知类型显示原值：不猜。
 *
 * `opening` 不是「探索」这类打法描述：`OpeningRoom` 是副本开场（非战斗叙事场景），
 * 而且 `enter_dungeon` 固定传送到 `rooms[0]`，所以它意味着「进入副本后的起点」。
 * 这个映射只写在这里，浮窗与确认框都从 `readDungeonInfo` 取，不各写一份。
 */
const ROOM_TYPE_LABELS: Record<string, string> = {
  opening: "开场",
  combat: "战斗",
};

export function readDungeonInfo(dungeon: Schemas["Dungeon"]) {
  const currentRoomIndex = dungeon.current_room_index;

  return {
    name: dungeon.name,
    profile: dungeon.profile,
    createdAt: formatCreatedAt(dungeon.created_at),
    /** 进行中的进度（第 N / M 间）；没有进行中的房间时为 null。 */
    progress:
      currentRoomIndex >= 0 && currentRoomIndex < dungeon.rooms.length
        ? `第 ${currentRoomIndex + 1} / ${dungeon.rooms.length} 间`
        : null,
    rooms: dungeon.rooms.map((room, index) => ({
      type: room.type,
      typeLabel: ROOM_TYPE_LABELS[room.type] ?? room.type,
      stageName: room.stage.name,
      /** 队伍当前所在的房间。 */
      isCurrent: index === currentRoomIndex,
      monsters: room.stage.actors.filter((actor) => actor.type === "Monster"),
    })),
  };
}
