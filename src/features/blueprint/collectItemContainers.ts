import type { Schemas } from "../../api/types";

type Blueprint = Schemas["Blueprint"];

/**
 * 从蓝图里收集「道具容器」（随身背包 / 储物箱）及其内容。
 *
 * ## 为什么要按 name 分派 + 逐字段校验
 *
 * `ComponentSerialization` 是 ECS 组件的**序列化信封**，不是带类型的领域模型：
 * `name` 是组件类名，`data` 是 `Dict[str, Any]`。后端自己反序列化时走的也是同一套路：
 *
 *     comp_class = resolve_component_type(comp.name, comp.data)   # 按 name 查注册表
 *     component  = comp_class(**comp.data)                        # 再用字典重建
 *     （见 src/ai_rpg/game/rpg_entity_manager.py 与 dbg_game.py）
 *
 * 也就是说 `data` 在契约里**本来就没有具体类型**——类型是运行时按 name 解析的。
 * 所以本模块不是"给契约缺口打补丁"，而是**前端版的 `resolve_component_type`**：
 * 按 name 认出自己关心的组件，再对 data 逐字段校验，不符合就丢弃。
 *
 * 代价要说清楚：data 内部的字段名写错，TypeScript 拦不住（它就是 `unknown`），
 * 只能靠这里的运行时校验兜住——校验失败会得到空列表，让测试失败而不是静默通过。
 */

/** 后端组件类名 → 界面标签。标签是固定的，不随持有者变化。 */
const CONTAINER_COMPONENTS = [
  { component: "InventoryComponent", label: "随身背包" },
  { component: "StorageComponent", label: "储物箱" },
] as const;

interface ContainerItem {
  name: string;
  type: string;
  count: number;
  description: string;
}

/** 把 unknown 收窄成"可以按字符串取值的对象"。数组也会通过，但取不到 items，自会被丢弃。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 收窄成一件物品；缺关键字段就丢掉，不猜。 */
function toItem(value: unknown): ContainerItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { name, type, description, count } = value;
  if (typeof name !== "string" || name === "" || typeof type !== "string") {
    return undefined;
  }
  return {
    name,
    type,
    description: typeof description === "string" ? description : "",
    count: typeof count === "number" ? count : 1,
  };
}

function readItems(data: unknown): ContainerItem[] {
  if (!isRecord(data) || !Array.isArray(data.items)) {
    return [];
  }
  return data.items.map(toItem).filter((item): item is ContainerItem => item !== undefined);
}

/** 蓝图里挂着的道具容器：随身背包、储物箱。两者都为空时返回空数组。 */
export function collectItemContainers(blueprint: Blueprint) {
  const allComponents = [
    ...blueprint.stages.flatMap((stage) => stage.actors.flatMap((actor) => actor.components)),
    ...blueprint.world_entities.flatMap((entity) => entity.components),
  ];

  return CONTAINER_COMPONENTS.flatMap(({ component, label }) => {
    // 同类容器只取第一个：当前每种只有一个（背包在玩家身上，储物箱在世界实体上）。
    // 将来真出现多个，再连同持有者一起展示。
    const source = allComponents.find((candidate) => candidate.name === component);
    const items = source ? readItems(source.data) : [];

    return items.length === 0 ? [] : [{ label, items }];
  });
}
