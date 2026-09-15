import type { Item, MaterialTotal } from "./types";

/**
 * 把材料类道具按名字汇总数量。
 *
 * 后端合成校验按名字累加储物箱里所有 `MaterialItem` 的 `count`
 * （见 `home_actions.py::activate_craft_consumable`），所以同名材料跨行相加。
 * 非材料道具直接跳过——它们不能送进工坊。
 */
export function collectMaterials(items: Item[]): MaterialTotal[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.type !== "MaterialItem") {
      continue;
    }
    totals.set(item.name, (totals.get(item.name) ?? 0) + item.count);
  }
  return [...totals].map(([name, count]) => ({ name, count }));
}
