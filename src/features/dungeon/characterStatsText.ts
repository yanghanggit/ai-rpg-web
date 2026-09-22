import type { Schemas } from "../../api/types";

/**
 * 角色卡上的属性一行。
 *
 * 默认**只有 `HP x/y`**：攻 / 防 是角色的静态属性（伤害主要来自牌），战斗中被参考的次数很少，
 * 所以卡面上省下这两个数字——一张卡就那么大。要看的时候点整张卡（角色信息浮窗里有完整属性）。
 *
 * `withAttackDefense` 是给**开局准备那一屏**的（`CombatSetupPanel`）：那时还没开打，对方的
 * 攻 / 防直接影响“先打谁 / 要不要打”的决策，所以连它一起给。同一个函数出两种写法，措辞不会分叉。
 *
 * 开场房与战斗房的角色卡共用这一份措辞。属性还没读出来时返回「（无属性数据）」，
 * 与"有属性但都是 0"区分开。
 */
export function characterStatsText(
  stats: Schemas["CharacterStats"] | null,
  withAttackDefense = false,
): string {
  if (stats === null) {
    return "（无属性数据）";
  }
  const hp = `HP ${stats.hp}/${stats.max_hp}`;
  return withAttackDefense ? `${hp} · 攻 ${stats.attack} · 防 ${stats.defense}` : hp;
}
