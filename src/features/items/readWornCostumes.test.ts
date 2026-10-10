import { describe, expect, it } from "vitest";
import { COMPONENT } from "../entities/componentNames";
import type { Entity } from "../entities/ecs";
import { readWornCostumes } from "./readWornCostumes";

/** 构造一个穿戴者实体；`item` 省略时表示该角色没有 WornCostumeComponent。 */
function entity(name: string, item?: unknown): Entity {
  return {
    name,
    data: item === undefined ? {} : { [COMPONENT.WornCostume]: { name, item } },
  };
}

describe("readWornCostumes", () => {
  it("读出穿戴者与那件时装", () => {
    const worn = readWornCostumes([
      entity("角色.螳螂", {
        name: "时装.机能风衣",
        uuid: "u1",
        type: "CostumeItem",
        description: "深灰色的工装",
        count: 1,
      }),
    ]);

    expect(worn).toEqual([
      {
        wearer: "角色.螳螂",
        item: {
          name: "时装.机能风衣",
          uuid: "u1",
          type: "CostumeItem",
          description: "深灰色的工装",
          count: 1,
        },
      },
    ]);
  });

  it("没有该组件、或 item 无法解析时跳过", () => {
    expect(
      readWornCostumes([entity("角色.甲"), entity("角色.乙", { type: "CostumeItem" })]),
    ).toEqual([]);
  });
});
