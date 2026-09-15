import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import { readItems } from "./readItems";

type Component = Schemas["ComponentSerialization"];

/** 只带一个储物箱组件的最小输入，方便逐个用例替换 items。 */
function withStorage(items: unknown[]): Component[] {
  return [{ name: "StorageComponent", data: { name: "世界.储物箱", items } }];
}

describe("readItems", () => {
  it("读出道具并收窄 type", () => {
    const items = readItems(
      withStorage([
        { name: "材料.旧麻绳", uuid: "u1", type: "MaterialItem", description: "麻绳", count: 3 },
      ]),
      "StorageComponent",
    );

    expect(items).toEqual([
      { name: "材料.旧麻绳", uuid: "u1", type: "MaterialItem", description: "麻绳", count: 3 },
    ]);
  });

  it("缺 name / type 或 type 未知的物品被丢弃", () => {
    const items = readItems(
      withStorage([
        { type: "MaterialItem" }, // 缺 name
        { name: "材料.没有类型" }, // 缺 type
        { name: "材料.未知类型", type: "UnknownItem" }, // type 不在已知四种里
        "根本不是对象",
        { name: "材料.旧麻绳", type: "MaterialItem", count: 3 },
      ]),
      "StorageComponent",
    );

    expect(items.map((item) => item.name)).toEqual(["材料.旧麻绳"]);
  });

  it("uuid / description / count 缺失时给保守默认值", () => {
    const items = readItems(
      withStorage([{ name: "消耗品.符水", type: "ConsumableItem" }]),
      "StorageComponent",
    );

    expect(items[0]).toEqual({
      name: "消耗品.符水",
      uuid: "",
      type: "ConsumableItem",
      description: "",
      count: 1,
    });
  });

  it("没有对应组件 / items 缺失或非数组时安全返回空", () => {
    expect(readItems(withStorage([]), "InventoryComponent")).toEqual([]);
    expect(readItems([{ name: "StorageComponent", data: {} }], "StorageComponent")).toEqual([]);
    expect(
      readItems([{ name: "StorageComponent", data: { items: "不是数组" } }], "StorageComponent"),
    ).toEqual([]);
  });
});
