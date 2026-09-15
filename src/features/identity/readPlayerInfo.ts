import type { Schemas } from "../../api/types";

type Entity = Schemas["EntitySerialization"];

/**
 * 从玩家实体的序列化数据里读出「角色信息浮窗」需要的字段。
 *
 * ## 为什么要按 name 分派 + 逐字段校验
 *
 * `ComponentSerialization` 是 ECS 组件的**序列化信封**，不是带类型的领域模型：
 * `name` 是组件类名，`data` 是 `Dict[str, Any]`。后端自己反序列化时也走同一套路
 * （`resolve_component_type` 按 name 查注册表，再用字典重建，见
 * `src/ai_rpg/game/rpg_entity_manager.py`）。所以 `data` 在契约里本就没有具体类型——
 * 这里是**前端版的 `resolve_component_type`**：按 name 认出关心的组件，再逐字段校验，
 * 不符合就返回 `null`（宁可少显示，也不猜）。
 *
 * 与 `blueprint/collectItemContainers.ts` 同一写法；字段名写错 TS 拦不住，靠运行时校验兜住。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findComponent(entity: Entity, componentName: string) {
  return entity.components.find((component) => component.name === componentName);
}

function readString(data: unknown, key: string): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function readNumber(data: unknown, key: string): number | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data[key];
  return typeof value === "number" ? value : null;
}

function readStats(data: unknown) {
  if (!isRecord(data) || !isRecord(data.stats)) {
    return null;
  }
  const hp = readNumber(data.stats, "hp");
  const max_hp = readNumber(data.stats, "max_hp");
  const attack = readNumber(data.stats, "attack");
  const defense = readNumber(data.stats, "defense");
  if (hp === null || max_hp === null || attack === null || defense === null) {
    return null;
  }
  return { hp, max_hp, attack, defense };
}

export function readPlayerInfo(entity: Entity) {
  const player = findComponent(entity, "PlayerComponent");
  const identity = findComponent(entity, "IdentityComponent");
  const appearance = findComponent(entity, "AppearanceComponent");
  const stats = findComponent(entity, "CharacterStatsComponent");

  return {
    player_name: readString(player?.data, "player_name"),
    entity_id: readString(identity?.data, "entity_id"),
    creation_order: readNumber(identity?.data, "creation_order"),
    base_body: readString(appearance?.data, "base_body"),
    appearance: readString(appearance?.data, "appearance"),
    stats: readStats(stats?.data),
  };
}
