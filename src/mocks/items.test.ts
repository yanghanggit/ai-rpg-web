import { describe, expect, it } from "vitest";
import { COMPONENT } from "../features/entities/componentNames";
import { readItems } from "../features/items/readItems";
import {
  addMockInventoryItems,
  craftMockItem,
  moveMockItem,
  readMockPlayerEntity,
  readMockStorageEntity,
} from "./items";

function storageItems() {
  return readItems(readMockStorageEntity().components, COMPONENT.Storage);
}

function inventoryItems() {
  return readItems(readMockPlayerEntity().components, COMPONENT.Inventory);
}

describe("mock 道具堆叠（对齐后端 Item 语义）", () => {
  it("合成消耗品两次：并入同一堆叠而非新增行", () => {
    craftMockItem("consumable", []);
    craftMockItem("consumable", []);

    const crafted = storageItems().filter((item) => item.name === "消耗品.回气散");
    expect(crafted).toHaveLength(1);
    expect(crafted[0]?.count).toBe(2);
  });

  it("移动消耗品到已有同堆叠的容器：数量累加", () => {
    craftMockItem("consumable", []);
    expect(moveMockItem("消耗品.回气散", "inventory")).toBe(true);
    craftMockItem("consumable", []);
    expect(moveMockItem("消耗品.回气散", "inventory")).toBe(true);

    const inventory = inventoryItems().filter((item) => item.name === "消耗品.回气散");
    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.count).toBe(2);
    expect(storageItems().some((item) => item.name === "消耗品.回气散")).toBe(false);
  });

  it("合成按名字消耗材料数量", () => {
    craftMockItem("consumable", ["材料.旧麻绳", "材料.旧麻绳"]);

    const rope = storageItems().find((item) => item.name === "材料.旧麻绳");
    expect(rope?.count).toBe(1);
  });

  it("装备不堆叠：合成两次产生两行", () => {
    craftMockItem("gear", []);
    craftMockItem("gear", []);

    const gear = storageItems().filter((item) => item.name === "装备.符纹刀");
    expect(gear).toHaveLength(2);
  });

  it("战利品并入背包：同名材料累加", () => {
    addMockInventoryItems([
      { name: "素材.腐骨", uuid: "a", type: "MaterialItem", description: "", count: 2 },
    ]);
    addMockInventoryItems([
      { name: "素材.腐骨", uuid: "b", type: "MaterialItem", description: "", count: 3 },
    ]);

    const bones = inventoryItems().filter((item) => item.name === "素材.腐骨");
    expect(bones).toHaveLength(1);
    expect(bones[0]?.count).toBe(5);
  });
});
