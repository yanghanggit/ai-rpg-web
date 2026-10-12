/**
 * 按 `IdentityComponent.creation_order` 给实体名排序（纯函数）。
 *
 * `actors_by_stage` 不带顺序、后端集合迭代顺序会变，所以用创建序号把展示顺序钉死；
 * 读不到顺序的名字排在末尾并保持原相对顺序。
 */
import { COMPONENT } from "./componentNames";
import { type EntitiesData, getComponentData, readNumber, resolveEntities } from "./ecs";

/** 实体名 → `creation_order`。缺 Identity / 字段读不出来的实体不在表里。 */
export type CreationOrder = ReadonlyMap<string, number>;

/** 从实体集合（`group` / `details` 的 `entities`）里读出「实体名 → creation_order」。 */
export function readCreationOrder(entities: EntitiesData): CreationOrder {
  const order = new Map<string, number>();
  for (const entity of resolveEntities(entities)) {
    const value = readNumber(getComponentData(entity, COMPONENT.Identity), "creation_order");
    if (value !== null) {
      order.set(entity.name, value);
    }
  }
  return order;
}

/** 按 creation_order 升序；未知顺序的沉底并保持原相对顺序。返回新数组，不修改入参。 */
export function sortByCreationOrder(names: readonly string[], order: CreationOrder): string[] {
  return names
    .map((name, position) => ({ name, position, rank: order.get(name) }))
    .sort((a, b) => {
      if (a.rank === undefined || b.rank === undefined) {
        // 未知顺序的一律沉底；都未知时保持原顺序
        if (a.rank === b.rank) {
          return a.position - b.position;
        }
        return a.rank === undefined ? 1 : -1;
      }
      return a.rank - b.rank || a.position - b.position;
    })
    .map((entry) => entry.name);
}
