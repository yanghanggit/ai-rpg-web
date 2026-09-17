import { isRecord } from "../entities/ecs";
import { ITEM_TYPES, type Item, type ItemType } from "./types";

function isItemType(value: unknown): value is ItemType {
  return typeof value === "string" && ITEM_TYPES.some((known) => known === value);
}

/**
 * 把 unknown 收窄成一件道具；缺关键字段或 `type` 未知就丢掉，不猜。
 *
 * 与 `blueprint/collectItemContainers.ts` 同一写法：`data` 在契约里就是
 * `Dict[str, Any]`，字段名写错 TypeScript 拦不住，只能靠运行时校验兜住。
 */
export function readItem(value: unknown): Item | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { name, uuid, type, description, count } = value;
  if (typeof name !== "string" || name === "" || !isItemType(type)) {
    return undefined;
  }
  return {
    name,
    uuid: typeof uuid === "string" ? uuid : "",
    type,
    description: typeof description === "string" ? description : "",
    count: typeof count === "number" ? count : 1,
  };
}
