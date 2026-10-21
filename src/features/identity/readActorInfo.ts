import { COMPONENT } from "../entities/componentNames";
import {
  type Entity,
  getComponentData,
  isRecord,
  readCharacterStats,
  readNumber,
  readString,
} from "../entities/ecs";

/**
 * 从角色实体的序列化数据里读出「角色信息浮窗」要的字段（玩家与 NPC 通用）。
 *
 * `PlayerComponent` 只有玩家有，其余组件都有。组件查找 / 字段读取一律走 `features/entities/ecs`
 * （契约里 `data` 是 `Dict[str, Any]`，字段名写错 TypeScript 拦不住）。
 */
function readWornCostume(data: unknown) {
  if (!isRecord(data) || !isRecord(data.item)) {
    return null;
  }
  const name = readString(data.item, "name");
  if (name === null) {
    return null;
  }
  return { name, description: readString(data.item, "description") ?? "" };
}

export function readActorInfo(entity: Entity) {
  return {
    player_name: readString(getComponentData(entity, COMPONENT.Player), "player_name"),
    entity_id: readString(getComponentData(entity, COMPONENT.Identity), "entity_id"),
    creation_order: readNumber(getComponentData(entity, COMPONENT.Identity), "creation_order"),
    base_body: readString(getComponentData(entity, COMPONENT.Appearance), "base_body"),
    appearance: readString(getComponentData(entity, COMPONENT.Appearance), "appearance"),
    stats: readCharacterStats(entity),
    worn_costume: readWornCostume(getComponentData(entity, COMPONENT.WornCostume)),
  };
}
