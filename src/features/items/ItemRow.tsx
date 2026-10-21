import { displayName } from "../../components/displayName";
import type { Item, ItemType } from "./types";

/** 道具类型 → 界面说法。契约里的 `ItemType` 是英文枚举名，展示一律用中文。 */
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  GearItem: "装备",
  CostumeItem: "时装",
  ConsumableItem: "消耗品",
  MaterialItem: "材料",
};

/** 显示名 + 数量后缀（`×N` 只在多于一件时出现）。 */
export function itemText(item: Item): string {
  return item.count > 1 ? `${displayName(item.name)} ×${item.count}` : displayName(item.name);
}

/**
 * 道具行：**「一件道具长什么样」的唯一实现**（道具管理、进副本前的背包清单……）。
 *
 * 三个可选部件对应三种用途：`onToggle` 给勾选框（道具管理）、`note` 用 chip 说明不能操作的原因
 * （储物箱里的时装）、两者都不给就是只读展示。
 */
export default function ItemRow({
  item,
  selected = false,
  onToggle,
  note,
}: {
  item: Item;
  selected?: boolean;
  /** 给了就渲染勾选框；勾选状态由调用方持有。 */
  onToggle?: () => void;
  /** 不可操作时的说明 chip。 */
  note?: string;
}) {
  return (
    <li className="item-row">
      {onToggle ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`选择 ${item.name}`}
        />
      ) : note ? (
        <span className="chip">{note}</span>
      ) : null}
      <span className="mono item-name">{itemText(item)}</span>
      <span className="chip">{ITEM_TYPE_LABELS[item.type]}</span>
      <span className="muted item-desc">{item.description}</span>
    </li>
  );
}
