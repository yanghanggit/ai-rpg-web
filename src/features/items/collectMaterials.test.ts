import { describe, expect, it } from "vitest";
import { collectMaterials } from "./collectMaterials";
import type { Item, ItemType } from "./types";

function item(name: string, type: ItemType, count: number): Item {
  return { name, uuid: "", type, description: "", count };
}

describe("collectMaterials", () => {
  it("只保留材料，同名跨行按数量汇总", () => {
    expect(
      collectMaterials([
        item("材料.旧麻绳", "MaterialItem", 3),
        item("装备.铁刀", "GearItem", 1),
        item("材料.旧麻绳", "MaterialItem", 2),
      ]),
    ).toEqual([{ name: "材料.旧麻绳", count: 5 }]);
  });

  it("没有材料时返回空数组", () => {
    expect(collectMaterials([item("时装.青衫", "CostumeItem", 1)])).toEqual([]);
  });
});
