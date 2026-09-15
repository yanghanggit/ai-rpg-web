import { type Card, type CardTargetType, TARGET_TYPES } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTargetType(value: unknown): value is CardTargetType {
  return typeof value === "string" && TARGET_TYPES.some((known) => known === value);
}

function readNumber(data: Record<string, unknown>, key: string, fallback: number): number {
  const value = data[key];
  return typeof value === "number" ? value : fallback;
}

function readBoolean(data: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = data[key];
  return typeof value === "boolean" ? value : fallback;
}

/** 词缀字段只收非空字符串（后端给的是自由文本列表）。 */
function readAffixes(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry !== "");
}

/**
 * 把 unknown 收窄成一张卡牌；没有名字或 `target_type` 不认识就丢掉，不猜。
 *
 * 与 `items/readItem.ts` 同一写法：`data` 在契约里就是 `Dict[str, Any]`，
 * 字段名写错 TypeScript 拦不住，只能靠运行时校验兜住。
 */
export function readCard(value: unknown): Card | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { name, description, source, target_type } = value;
  if (typeof name !== "string" || name === "" || !isTargetType(target_type)) {
    return undefined;
  }
  return {
    name,
    uuid: typeof value.uuid === "string" ? value.uuid : "",
    description: typeof description === "string" ? description : "",
    source: typeof source === "string" ? source : "",
    cost: readNumber(value, "cost", 1),
    damage: readNumber(value, "damage", 0),
    hit_count: readNumber(value, "hit_count", 1),
    block: readNumber(value, "block", 0),
    target_type,
    self_target: readBoolean(value, "self_target", false),
    on_play_affixes: readAffixes(value, "on_play_affixes"),
    on_hit_affixes: readAffixes(value, "on_hit_affixes"),
    on_turn_end_affixes: readAffixes(value, "on_turn_end_affixes"),
    exhaust: readBoolean(value, "exhaust", false),
    retain: readBoolean(value, "retain", false),
    ethereal: readBoolean(value, "ethereal", false),
    playable: readBoolean(value, "playable", true),
  };
}
