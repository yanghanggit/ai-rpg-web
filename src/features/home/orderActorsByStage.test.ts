import { describe, expect, it } from "vitest";
import { orderActorsByStage } from "./orderActorsByStage";

const actorsByStage = {
  "场景.阁楼隔间": ["角色.麻雀"],
  "场景.酒吧大厅": ["角色.零号", "角色.螳螂"],
  "场景.后巷工位": [],
};

// 场景：酒吧大厅(20) → 后巷工位(30) → 阁楼隔间(40)；角色：螳螂(1) → 零号(2) → 麻雀(3)
const order = new Map([
  ["场景.酒吧大厅", 20],
  ["场景.后巷工位", 30],
  ["场景.阁楼隔间", 40],
  ["角色.螳螂", 1],
  ["角色.零号", 2],
  ["角色.麻雀", 3],
]);

describe("orderActorsByStage", () => {
  it("场景之间、场景内的角色都按 creation_order 升序", () => {
    expect(Object.keys(orderActorsByStage(actorsByStage, order))).toEqual([
      "场景.酒吧大厅",
      "场景.后巷工位",
      "场景.阁楼隔间",
    ]);
    expect(orderActorsByStage(actorsByStage, order)["场景.酒吧大厅"]).toEqual([
      "角色.螳螂",
      "角色.零号",
    ]);
  });

  it("读不到顺序时保持原始相对顺序并沉底", () => {
    const only = new Map([["角色.螳螂", 1]]);
    const ordered = orderActorsByStage(actorsByStage, only);
    expect(Object.keys(ordered)).toEqual(["场景.阁楼隔间", "场景.酒吧大厅", "场景.后巷工位"]);
    expect(ordered["场景.酒吧大厅"]).toEqual(["角色.螳螂", "角色.零号"]);
  });

  it("不修改入参", () => {
    orderActorsByStage(actorsByStage, order);
    expect(Object.keys(actorsByStage)).toEqual(["场景.阁楼隔间", "场景.酒吧大厅", "场景.后巷工位"]);
    expect(actorsByStage["场景.酒吧大厅"]).toEqual(["角色.零号", "角色.螳螂"]);
  });
});
