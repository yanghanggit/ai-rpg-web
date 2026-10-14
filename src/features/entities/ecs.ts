/**
 * ECS 组件载荷读取（纯函数）。
 *
 * 只放**跨领域共用**的部分：类型与集合解析、通用访问（`getComponentData` / `hasComponent` /
 * `readString|readNumber|readBoolean`）与共享读取器 `readCharacterStats`；领域专属读取器留在各自领域。
 * 组件 `data` 是 `Dict[str, Any]`，所以逐字段运行时校验：读不出来返回 `null` / 空值，不猜。
 */
import type { Schemas } from "../../api/types";
import { COMPONENT, type ComponentName } from "./componentNames";

/** 实体集合：实体名 → 该实体的组件数据（`/entities/.../details` 的 `entities`）。 */
export type EntitiesData = Schemas["EntitiesDetailsResponse"]["entities"];

/** 单个实体的组件数据：组件类名 → `data`。 */
export type EntityData = NonNullable<EntitiesData[string]>;

/** 单个组件的载荷（`Dict[str, Any]`）。 */
export type ComponentData = NonNullable<EntityData[string]>;

/** 带名字的实体（实体名 + 组件数据），供需要显示名字的读取器使用。 */
export type Entity = { name: string; data: EntityData };

/** 把实体集合展开为「带名字的实体」列表（保序，即后端给的顺序）。 */
export function resolveEntities(entities: EntitiesData): Entity[] {
  return Object.entries(entities).map(([name, data]) => ({ name, data }));
}

/** 取指定名字的实体；不存在返回 `undefined`。 */
export function resolveEntity(entities: EntitiesData, name: string): Entity | undefined {
  const data = entities[name];
  return data === undefined ? undefined : { name, data };
}

/** 实体名列表（保序）。 */
export function entityNames(entities: EntitiesData): string[] {
  return Object.keys(entities);
}

/** 第一个实体（后端多数细节查询只请求一个实体）。 */
export function firstEntity(entities: EntitiesData): Entity | undefined {
  const [name, data] = Object.entries(entities)[0] ?? [];
  return name === undefined || data === undefined ? undefined : { name, data };
}

/** 把 unknown 收窄成「可以按字符串取值的对象」；数组也会通过，但取不到字段，自会被丢弃。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 按类名取组件的 `data`（`Dict[str, Any]`）；组件不存在返回 `undefined`。 */
export function getComponentData(
  entity: Entity,
  componentName: ComponentName,
): ComponentData | undefined {
  return entity.data[componentName];
}

/** 实体是否挂了某个组件（标记类组件只判存在性）。 */
export function hasComponent(entity: Entity, componentName: ComponentName): boolean {
  return entity.data[componentName] !== undefined;
}

/** 读一个非空字符串字段；缺失 / 类型不对 / 空串一律返回 `null`。 */
export function readString(data: unknown, key: string): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/** 读一个数字字段；缺失或类型不对返回 `null`。 */
export function readNumber(data: unknown, key: string): number | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data[key];
  return typeof value === "number" ? value : null;
}

/** 读一个布尔字段；缺失或类型不对返回 `null`。 */
export function readBoolean(data: unknown, key: string): boolean | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data[key];
  return typeof value === "boolean" ? value : null;
}

/**
 * 读 `CharacterStatsComponent.stats`（玩家 / 队友 / 怪物通用）；字段对齐 `Schemas["CharacterStats"]`。
 */
export function readCharacterStats(entity: Entity): Schemas["CharacterStats"] | null {
  const data = getComponentData(entity, COMPONENT.CharacterStats);
  if (data === undefined || !isRecord(data.stats)) {
    return null;
  }
  const stats = data.stats;
  const hp = readNumber(stats, "hp");
  const max_hp = readNumber(stats, "max_hp");
  const attack = readNumber(stats, "attack");
  const defense = readNumber(stats, "defense");
  const speed = readNumber(stats, "speed");
  if (hp === null || max_hp === null || attack === null || defense === null || speed === null) {
    return null;
  }
  return { hp, max_hp, attack, defense, speed };
}
