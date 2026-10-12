import { describe, expect, it } from "vitest";
import { orderActorsByStage } from "./orderActorsByStage";

const actorsByStage = {
  "场景.铁匠铺": ["角色.麻雀"],
  "场景.佣兵公会": ["角色.无名", "角色.坏运气"],
  "场景.酒馆": [],
};

// 场景：佣兵公会(20) → 酒馆(30) → 铁匠铺(40)；角色：坏运气(1) → 无名(2) → 麻雀(3)
const order = new Map([
  ["场景.佣兵公会", 20],
  ["场景.酒馆", 30],
  ["场景.铁匠铺", 40],
  ["角色.坏运气", 1],
  ["角色.无名", 2],
  ["角色.麻雀", 3],
]);

describe("orderActorsByStage", () => {
  it("场景之间、场景内的角色都按 creation_order 升序", () => {
    expect(Object.keys(orderActorsByStage(actorsByStage, order))).toEqual([
      "场景.佣兵公会",
      "场景.酒馆",
      "场景.铁匠铺",
    ]);
    expect(orderActorsByStage(actorsByStage, order)["场景.佣兵公会"]).toEqual([
      "角色.坏运气",
      "角色.无名",
    ]);
  });

  it("读不到顺序时保持原始相对顺序并沉底", () => {
    const only = new Map([["角色.坏运气", 1]]);
    const ordered = orderActorsByStage(actorsByStage, only);
    expect(Object.keys(ordered)).toEqual(["场景.铁匠铺", "场景.佣兵公会", "场景.酒馆"]);
    expect(ordered["场景.佣兵公会"]).toEqual(["角色.坏运气", "角色.无名"]);
  });

  it("不修改入参", () => {
    orderActorsByStage(actorsByStage, order);
    expect(Object.keys(actorsByStage)).toEqual(["场景.铁匠铺", "场景.佣兵公会", "场景.酒馆"]);
    expect(actorsByStage["场景.佣兵公会"]).toEqual(["角色.无名", "角色.坏运气"]);
  });
});
