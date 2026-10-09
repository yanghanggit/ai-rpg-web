/**
 * 按 `IdentityComponent.creation_order` 给实体排序（纯函数）。
 *
 * ## 为什么需要它
 *
 * `StagesStateResponse.actors_by_stage` 只给「场景 → 角色名」两组名字，**不带顺序**。
 * 后端这一层是从 `Set[Entity]` 摊出来的，集合迭代顺序会随增删变化，于是同一局游戏里
 * 每次刷新（推进 / 切换场景）卡片与角色 chip 都可能悄悄换位——玩家靠位置记空间，
 * 这是纯粹的显示事故。
 *
 * 后端给每个实体挂了 `IdentityComponent`，其中 `creation_order` 是创建序号，**不随
 * 增删变化**。所以前端拿到「实体名 → creation_order」后，就能把展示顺序钉死。
 *
 * ## 数据从哪来
 *
 * 后端没有单独的「顺序」接口，但 `group?all_of=IdentityComponent` 返回所有挂 Identity
 * 的实体（世界 / 场景 / 角色），每个都带 `creation_order`——查询入口见 `useCreationOrder`。
 *
 * ## 读不到就退回去
 *
 * `creation_order` 缺失（旧数据 / 未命中 mock）时**不猜测**：保留调用方给的原始相对顺序，
 * 只是把它们排在已知顺序的实体之后，让界面至少稳定、不报错。
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

/**
 * 按 `creation_order` 升序排序实体名。
 *
 * 读不到顺序的名字统一排在末尾，并保持它们在 `names` 里的原始相对顺序；读得到顺序的
 * 则严格按序号排（序号相同再按原始位置）。返回新数组，不修改入参。
 */
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
