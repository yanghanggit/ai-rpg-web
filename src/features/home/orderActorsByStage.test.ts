import { describe, expect, it } from "vitest";
import { orderActorsByStage } from "./orderActorsByStage";

const actorsByStage = {
  "场景.二楼卧室": ["角色.小厮"],
  "场景.门厅": ["角色.无名", "角色.顾知秋"],
  "场景.一楼客房": [],
};

// 场景：门厅(20) → 一楼客房(30) → 二楼卧室(40)；角色：顾知秋(1) → 无名(2) → 小厮(3)
const order = new Map([
  ["场景.门厅", 20],
  ["场景.一楼客房", 30],
  ["场景.二楼卧室", 40],
  ["角色.顾知秋", 1],
  ["角色.无名", 2],
  ["角色.小厮", 3],
]);

describe("orderActorsByStage", () => {
  it("场景之间、场景内的角色都按 creation_order 升序", () => {
    expect(Object.keys(orderActorsByStage(actorsByStage, order))).toEqual([
      "场景.门厅",
      "场景.一楼客房",
      "场景.二楼卧室",
    ]);
    expect(orderActorsByStage(actorsByStage, order)["场景.门厅"]).toEqual([
      "角色.顾知秋",
      "角色.无名",
    ]);
  });

  it("读不到顺序时保持原始相对顺序并沉底", () => {
    const only = new Map([["角色.顾知秋", 1]]);
    const ordered = orderActorsByStage(actorsByStage, only);
    expect(Object.keys(ordered)).toEqual(["场景.二楼卧室", "场景.门厅", "场景.一楼客房"]);
    expect(ordered["场景.门厅"]).toEqual(["角色.顾知秋", "角色.无名"]);
  });

  it("不修改入参", () => {
    orderActorsByStage(actorsByStage, order);
    expect(Object.keys(actorsByStage)).toEqual(["场景.二楼卧室", "场景.门厅", "场景.一楼客房"]);
    expect(actorsByStage["场景.门厅"]).toEqual(["角色.无名", "角色.顾知秋"]);
  });
});
