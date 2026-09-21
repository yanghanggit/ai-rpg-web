import type { Schemas } from "../../api/types";

/**
 * 战斗属性一行：`HP 9/9 · 攻 3 · 防 1`。
 *
 * 开场房与战斗房的角色卡共用这一份措辞——两处各写一套（一个 `HP / ATK / DEF` 换行、一个
 * `HP · 攻 · 防`）迟早会分叉。属性还没读出来时返回「（无属性数据）」，与"有属性但都是 0"区分开。
 */
export function characterStatsText(stats: Schemas["CharacterStats"] | null): string {
  if (stats === null) {
    return "（无属性数据）";
  }
  return `HP ${stats.hp}/${stats.max_hp} · 攻 ${stats.attack} · 防 ${stats.defense}`;
}
