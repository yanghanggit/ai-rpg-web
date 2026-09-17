import type { Schemas } from "../../api/types";
import { readCard } from "./readCard";
import type { Card } from "./types";

/**
 * 从序列化组件里读出卡牌数组。
 *
 * 载荷字段名由 `field` 指定（默认 `cards`）：
 * - `DeckComponent` → `cards`；
 * - `SpoilsComponent` → `candidate_cards`（待领取）/ `claimed_cards`（已领取）。
 *
 * `data[field]` 缺失或不是数组时安全返回空数组（组件尚未生成是常态）。
 */
export function readCards(
  components: Schemas["ComponentSerialization"][],
  componentName: string,
  field = "cards",
): Card[] {
  const data = components.find((component) => component.name === componentName)?.data;
  if (data === undefined || !Array.isArray(data[field])) {
    return [];
  }
  return data[field].map(readCard).filter((card): card is Card => card !== undefined);
}
