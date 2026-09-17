/**
 * ECS 组件载荷读取（纯函数，无 React / 网络）。
 *
 * ## 为什么要有这一层
 *
 * `ComponentSerialization` 是 ECS 组件的**序列化信封**，不是带类型的领域模型：
 * `name` 是组件类名，`data` 是 `Dict[str, Any]`。后端自己反序列化时也走同一套路
 * （`resolve_component_type` 按 name 查注册表，再用字典重建，见
 * `src/ai_rpg/game/rpg_entity_manager.py`）。所以 `data` 在契约里本就没有具体类型——
 * 这里是**前端版的 `resolve_component_type`**：按 name 认出关心的组件，再逐字段校验。
 *
 * 字段名写错 TypeScript 拦不住（它就是 `unknown`），只能靠运行时校验兜住：
 * 读不出来就返回 `null` / 空值，让界面少显示而不是显示错的。
 *
 * ## 边界
 *
 * - 这里只放**跨领域共用**的那一层：通用访问（`getComponent` / `hasComponent` / 字段读取）
 *   与一个共享的类型化读取器（`readCharacterStats`）；
 * - 领域专属读取器（手牌 / 牌堆 / 时装 / 名单…）留在各自领域，不进本模块。
 *
 * 归属 `features/entities/` 而不是 `api/`：逐字段读取带着「哪个组件、哪些字段有意义」的
 * 领域含义，不只是传输层胶水；而 `entities` 已是仓库里实体相关基础设施的共享落点
 * （`invalidateEntities` 被 dungeon / costume / items 共用），依赖方向天然无环。
 */
import type { Schemas } from "../../api/types";

type Entity = Schemas["EntitySerialization"];
type Component = Schemas["ComponentSerialization"];

/** 把 unknown 收窄成「可以按字符串取值的对象」；数组也会通过，但取不到字段，自会被丢弃。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 按类名取组件信封；不存在返回 `undefined`。 */
export function getComponent(entity: Entity, componentName: string): Component | undefined {
  return entity.components.find((component) => component.name === componentName);
}

/** 按类名取组件的 `data`（`Dict[str, Any]`）；组件不存在返回 `undefined`。 */
export function getComponentData(
  entity: Entity,
  componentName: string,
): Record<string, unknown> | undefined {
  return getComponent(entity, componentName)?.data;
}

/** 实体是否挂了某个组件（标记类组件只判存在性）。 */
export function hasComponent(entity: Entity, componentName: string): boolean {
  return entity.components.some((component) => component.name === componentName);
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
 * 读 `CharacterStatsComponent.stats`（玩家 / 队友 / 怪物通用）。
 *
 * 这是目前**唯一**被多个领域共用的类型化读取器（身份 / 出征点验 / 战斗），所以放在共享层；
 * 字段直接对齐生成的 `Schemas["CharacterStats"]`，不另手写一份形状。
 */
export function readCharacterStats(entity: Entity): Schemas["CharacterStats"] | null {
  const data = getComponentData(entity, "CharacterStatsComponent");
  if (data === undefined || !isRecord(data.stats)) {
    return null;
  }
  const stats = data.stats;
  const hp = readNumber(stats, "hp");
  const max_hp = readNumber(stats, "max_hp");
  const attack = readNumber(stats, "attack");
  const defense = readNumber(stats, "defense");
  if (hp === null || max_hp === null || attack === null || defense === null) {
    return null;
  }
  return { hp, max_hp, attack, defense };
}
