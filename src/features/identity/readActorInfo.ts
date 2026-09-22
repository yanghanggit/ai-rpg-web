import type { Schemas } from "../../api/types";
import { COMPONENT } from "../entities/componentNames";
import {
  getComponentData,
  isRecord,
  readCharacterStats,
  readNumber,
  readString,
} from "../entities/ecs";

type Entity = Schemas["EntitySerialization"];

/**
 * 从角色实体的序列化数据里读出「角色信息浮窗」需要的字段。
 *
 * 对玩家与 NPC 通用：`PlayerComponent` 只有玩家有（NPC 读到 `null`），
 * 其余 Identity / Appearance / CharacterStats / WornCostume 都是所有角色共有的组件。
 *
 * 组件查找 / 字段读取 / 属性解析统一走 `features/entities/ecs`（契约里 `data` 是
 * `Dict[str, Any]`，字段名写错 TypeScript 拦不住，只能运行时校验）；这里只保留
 * 「这个浮窗要看哪些字段」的领域选择，以及时装条目这一处结构读取。
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
