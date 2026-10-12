import type { Schemas } from "../../api/types";
import { COMPONENT } from "../entities/componentNames";
import { type EntityData, isRecord } from "../entities/ecs";

type Blueprint = Schemas["Blueprint"];

/**
 * 从蓝图里收集道具容器（随身背包 / 储物箱）及其内容。
 *
 * 组件 dump 是 name-keyed dict、`data` 为 `Dict[str, Any]`，所以按 name 分派再逐字段校验：
 * 这是前端版的 `resolve_component_type`，字段写错 TypeScript 拦不住，靠运行时校验兜住。
 */

/** 后端组件类名 → 界面标签。标签是固定的，不随持有者变化。 */
const CONTAINER_COMPONENTS = [
  { component: COMPONENT.Inventory, label: "随身背包" },
  { component: COMPONENT.Storage, label: "储物箱" },
] as const;

interface ContainerItem {
  name: string;
  type: string;
  count: number;
  description: string;
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
  const allComponents: EntityData[] = [
    ...blueprint.stages.flatMap((stage) => stage.actors.map((actor) => actor.components)),
    ...blueprint.world_entities.map((entity) => entity.components),
  ];

  return CONTAINER_COMPONENTS.flatMap(({ component, label }) => {
    /** 同类容器只取第一个（当前每种只有一个）；将来出现多个再连同持有者一起展示。 */
    const data = allComponents.find((components) => components[component] !== undefined)?.[
      component
    ];
    const items = data ? readItems(data) : [];

    return items.length === 0 ? [] : [{ label, items }];
  });
}
