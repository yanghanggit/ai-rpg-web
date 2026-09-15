import type { Schemas } from "../../api/types";
import { readItem } from "./readItem";
import type { Item } from "./types";

/**
 * 从序列化组件里读出某个容器（`InventoryComponent` / `StorageComponent`）的道具。
 *
 * 同类容器只取第一个：当前背包在玩家身上、储物箱在世界实体上，各只有一个。
 * `data.items` 缺失或不是数组时安全返回空数组（蓝图里挂着一堆空组件是常态）。
 */
export function readItems(
  components: Schemas["ComponentSerialization"][],
  componentName: string,
): Item[] {
  const data = components.find((component) => component.name === componentName)?.data;
  if (data === undefined || !Array.isArray(data.items)) {
    return [];
  }
  return data.items.map(readItem).filter((item): item is Item => item !== undefined);
}
