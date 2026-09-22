import type { Schemas } from "../../api/types";
import { COMPONENT } from "../entities/componentNames";
import { getComponentData } from "../entities/ecs";
import { readItem } from "./readItem";
import type { WornCostume } from "./types";

/**
 * 从 `group?all_of=WornCostumeComponent` 返回的实体里读出「谁穿着哪件时装」。
 *
 * 每个结果实体就是一位穿戴者（实体名 = 角色名），`data.item` 是那件 `CostumeItem`。
 * 时装一旦穿上就会从储物箱移除（见后端 `wear_costume_action_system.py`），
 * 所以这份列表与储物箱里的时装不重叠，界面上作为独立的只读子区展示。
 */
export function readWornCostumes(entities: Schemas["EntitySerialization"][]): WornCostume[] {
  const worn: WornCostume[] = [];
  for (const entity of entities) {
    const data = getComponentData(entity, COMPONENT.WornCostume);
    if (data === undefined) {
      continue;
    }
    const item = readItem(data.item);
    if (item === undefined) {
      continue;
    }
    worn.push({ wearer: entity.name, item });
  }
  return worn;
}
