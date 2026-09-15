import type { Schemas } from "../../api/types";

type Entity = Schemas["EntitySerialization"];

/**
 * 从角色实体里读出「出征前点验」需要的信息：是不是玩家本人、是否已死亡、战斗属性。
 *
 * 与 `identity/readActorInfo.ts` 同一写法：`ComponentSerialization.data` 是
 * `Dict[str, Any]`，字段名写错 TypeScript 拦不住，只能按组件名认出后逐字段校验；
 * 属性读不出来就返回 `null`（宁可少显示，也不猜）。
 *
 * `DeathComponent` 只有有无之分（后端把死亡当标记），所以只判存在性——它决定了
 * 「能不能进副本」：后端 `enter_dungeon` 会断言队伍成员都没死，否则整个请求 500。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function readPartyMember(entity: Entity) {
  const has = (componentName: string) =>
    entity.components.some((component) => component.name === componentName);

  return {
    name: entity.name,
    player: has("PlayerComponent"),
    dead: has("DeathComponent"),
    stats: readStats(entity.components.find((c) => c.name === "CharacterStatsComponent")?.data),
  };
}
