import { describe, expect, it } from "vitest";
import { COMPONENT } from "./componentNames";
import { readCreationOrder, sortByCreationOrder } from "./creationOrder";
import type { EntitiesData } from "./ecs";

const entities: EntitiesData = {
  "场景.酒吧大厅": {
    [COMPONENT.Identity]: { name: "场景.酒吧大厅", creation_order: 20, entity_id: "a" },
  },
  "场景.后巷工位": {
    [COMPONENT.Identity]: { name: "场景.后巷工位", creation_order: 10, entity_id: "b" },
  },
  "角色.零号": { [COMPONENT.Identity]: { name: "角色.零号", creation_order: 1 } },
  // 没挂 Identity：排序时应沉底、不报错
  "世界.储物箱": { [COMPONENT.Storage]: { name: "世界.储物箱", items: [] } },
  // 挂了 Identity 但字段读不出来：同样不收录
  坏实体: { [COMPONENT.Identity]: { name: "坏实体" } },
};

describe("readCreationOrder", () => {
  it("读出「实体名 → creation_order」，缺 Identity / 字段读不出来的不收录", () => {
    expect([...readCreationOrder(entities)]).toEqual([
      ["场景.酒吧大厅", 20],
      ["场景.后巷工位", 10],
      ["角色.零号", 1],
    ]);
  });

  it("空集合返回空表", () => {
    expect(readCreationOrder({}).size).toBe(0);
  });
});

describe("sortByCreationOrder", () => {
  it("按 creation_order 升序排序", () => {
    const order = readCreationOrder(entities);
    expect(sortByCreationOrder(["场景.酒吧大厅", "场景.后巷工位", "角色.零号"], order)).toEqual([
      "角色.零号",
      "场景.后巷工位",
      "场景.酒吧大厅",
    ]);
  });

  it("读不到顺序的名字沉底，并保持原始相对顺序", () => {
    const order = new Map([["a", 1]]);
    expect(sortByCreationOrder(["x", "a", "y"], order)).toEqual(["a", "x", "y"]);
  });

  it("序号相同时按原始位置稳定排序", () => {
    const order = new Map([
      ["a", 1],
      ["b", 1],
    ]);
    expect(sortByCreationOrder(["b", "a"], order)).toEqual(["b", "a"]);
  });

  it("不修改入参", () => {
    const names = ["b", "a"];
    sortByCreationOrder(names, new Map([["a", 1]]));
    expect(names).toEqual(["b", "a"]);
  });
});
