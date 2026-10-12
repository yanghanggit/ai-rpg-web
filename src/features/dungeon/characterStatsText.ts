import type { Schemas } from "../../api/types";

/**
 * 角色卡上的属性一行：默认只有 `hp x/y`；`withAttackDefense`（开局准备屏）再加 `attack` / `defense`。
 * 字段名一律用 `CharacterStats` 原英文，避免中文「生命」的歧义。属性读不出来返回「（无属性数据）」。
 */
export function characterStatsText(
  stats: Schemas["CharacterStats"] | null,
  withAttackDefense = false,
): string {
  if (stats === null) {
    return "（无属性数据）";
  }
  const hp = `hp ${stats.hp}/${stats.max_hp}`;
  return withAttackDefense ? `${hp} · attack ${stats.attack} · defense ${stats.defense}` : hp;
}
