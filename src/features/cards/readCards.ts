import type { Schemas } from "../../api/types";
import { readCard } from "./readCard";
import type { Card } from "./types";

/**
 * 从序列化组件里读出牌组（`DeckComponent`）或卡池（`SpoilsComponent`）的卡牌。
 *
 * 两者的载荷形状相同（`data.cards`），只是语义不同：牌组是已有的牌，卡池是 3 张候选。
 * `data.cards` 缺失或不是数组时安全返回空数组（组件尚未生成是常态）。
 */
export function readCards(
  components: Schemas["ComponentSerialization"][],
  componentName: string,
): Card[] {
  const data = components.find((component) => component.name === componentName)?.data;
  if (data === undefined || !Array.isArray(data.cards)) {
    return [];
  }
  return data.cards.map(readCard).filter((card): card is Card => card !== undefined);
}
