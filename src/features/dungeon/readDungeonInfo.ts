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
 * 把副本的静态模型数据整理成浮窗好渲染的形状。
 *
 * 数据本身就是生成物类型（`Schemas["Dungeon"]`），所以这里不做校验，只做两件展示层的事：
 * - 房间类型直接用判别字段 `room.type`（不学 TUI 用「场景里有没有怪物」去猜）；
 * - 敌人从 `room.stage.actors` 里按 `ActorType === "Monster"` 取。
 */
export function readDungeonInfo(dungeon: Schemas["Dungeon"]) {
  return {
    name: dungeon.name,
    profile: dungeon.profile,
    createdAt: formatCreatedAt(dungeon.created_at),
    rooms: dungeon.rooms.map((room) => ({
      type: room.type,
      stageName: room.stage.name,
      monsters: room.stage.actors.filter((actor) => actor.type === "Monster"),
    })),
  };
}
