/**
 * 道具管理领域的共享类型。
 *
 * 后端没有把 `AnyItem` 暴露进 OpenAPI（`ComponentSerialization.data` 是
 * `Dict[str, Any]`），所以这里手写不了契约类型——`ItemType` 的取值必须与
 * `ai-rpg` 的 `models/items.py::ItemType` 保持一致，靠运行时校验兜住。
 */

/** 道具类型判别值，与后端 `ItemType` 的字符串值一一对应。 */
export const ITEM_TYPES = ["GearItem", "CostumeItem", "ConsumableItem", "MaterialItem"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/** 校验后的道具：只保留界面需要的字段，`type` 已收窄到已知四种。 */
export interface Item {
  name: string;
  uuid: string;
  type: ItemType;
  description: string;
  count: number;
}

/** 穿戴中的时装（`WornCostumeComponent`）：谁 + 哪件。 */
export interface WornCostume {
  wearer: string;
  item: Item;
}

/** 材料汇总：同名材料按名字合并，`count` 为总量（与后端合成校验口径一致）。 */
export interface MaterialTotal {
  name: string;
  count: number;
}
