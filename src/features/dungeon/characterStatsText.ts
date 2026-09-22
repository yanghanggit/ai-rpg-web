import type { Schemas } from "../../api/types";

/**
 * 角色卡上的属性一行：**只有 `HP 9/9`**。
 *
 * 攻 / 防 **不进卡面**：伤害主要来自牌，它们在一场战斗里被参考的次数很少（真正的用处是让"这个人
 * 有多硬"可读），所以卡面上省下这两个数字——一张卡就那么大，卡面上每多一项就少一分可读性。
 * 要看的时候点整张卡（角色信息浮窗里有完整的攻 / 防）。
 *
 * 开场房与战斗房的角色卡共用这一份措辞——两处各写一套迟早会分叉。
 * 属性还没读出来时返回「（无属性数据）」，与"有属性但都是 0"区分开。
 */
export function characterStatsText(stats: Schemas["CharacterStats"] | null): string {
  if (stats === null) {
    return "（无属性数据）";
  }
  return `HP ${stats.hp}/${stats.max_hp}`;
}
