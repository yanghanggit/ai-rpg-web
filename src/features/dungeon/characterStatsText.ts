import type { Schemas } from "../../api/types";

/**
 * 角色卡上的属性一行：默认只有 `HP x/y`；`withCombatStats`（开局准备屏）再加 `attack` / `defense` / `speed`。
 * 字段名一律用 `CharacterStats` 原英文，避免中文「生命」的歧义（`HP` 是唯一大写的一条，按界面惯例写）。
 * 属性读不出来返回「（无属性数据）」。
 */
export function characterStatsText(
  stats: Schemas["CharacterStats"] | null,
  withCombatStats = false,
): string {
  if (stats === null) {
    return "（无属性数据）";
  }
  const hp = `HP ${stats.hp}/${stats.max_hp}`;
  return withCombatStats
    ? `${hp} · attack ${stats.attack} · defense ${stats.defense} · speed ${stats.speed}`
    : hp;
}
