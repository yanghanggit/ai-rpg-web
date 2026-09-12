import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import { blueprintFixture } from "../../mocks/fixtures";
import { collectItemContainers } from "./collectItemContainers";

type Component = Schemas["ComponentSerialization"];

/** 只带一个世界实体的最小蓝图，方便逐个用例替换 components。 */
function blueprintWithStorage(components: Component[]): Schemas["Blueprint"] {
  return {
    name: "Game1",
    player_actor: "角色.玩家",
    campaign_setting: "",
    system_rules: "",
    knowledge_base: {},
    stages: [],
    world_entities: [{ name: "世界.储物箱", system_message: "", components }],
  };
}

const storageWithItems = (items: unknown[]): Component[] => [
  { name: "StorageComponent", data: { name: "世界.储物箱", items } },
];

describe("collectItemContainers", () => {
  it("把随身背包与储物箱收进来，标签是固定的两个", () => {
    const containers = collectItemContainers(blueprintFixture);

    expect(containers.map((container) => container.label)).toEqual(["随身背包", "储物箱"]);
    expect(containers[0]?.items.map((item) => item.name)).toEqual([
      "装备.缠麻短刃",
      "消耗品.吗啡针剂",
    ]);
    expect(containers[1]?.items.map((item) => item.name)).toEqual(["材料.旧麻绳"]);
  });

  it("保留 count 与 description（界面要显示「×N」和描述）", () => {
    const backpack = collectItemContainers(blueprintFixture).find((c) => c.label === "随身背包");
    const consumable = backpack?.items.find((item) => item.name === "消耗品.吗啡针剂");

    expect(consumable?.count).toBe(2);
    expect(consumable?.description).toBe("（mock）淡琥珀色的玻璃针剂。");
  });

  it("同类容器只取第一个（不重复列出多个同名标签）", () => {
    const blueprint: Schemas["Blueprint"] = {
      ...blueprintWithStorage(storageWithItems([{ name: "a", type: "MaterialItem" }])),
      stages: [
        ...blueprintFixture.stages,
        {
          name: "场景.额外",
          type: "Home",
          profile: "",
          system_message: "",
          actors: [
            {
              name: "角色.另一个",
              type: "NPC",
              profile: "",
              base_body: "",
              system_message: "",
              character_stats: { hp: 1, max_hp: 1, attack: 1, defense: 1 },
              components: [
                {
                  name: "InventoryComponent",
                  data: { items: [{ name: "b", type: "MaterialItem" }] },
                },
              ],
            },
          ],
          components: [],
        },
      ],
    };

    // blueprintFixture 已有背包；第二个不被重复列出
    expect(collectItemContainers(blueprint).map((container) => container.label)).toEqual([
      "随身背包",
      "储物箱",
    ]);
  });

  it("没有 items 的容器不出现（蓝图里挂着一堆空组件）", () => {
    expect(collectItemContainers(blueprintWithStorage(storageWithItems([])))).toEqual([]);
  });

  it("没有对应组件时不出现", () => {
    expect(
      collectItemContainers(
        blueprintWithStorage([{ name: "PlayerAuditComponent", data: { name: "世界.储物箱" } }]),
      ),
    ).toEqual([]);
  });

  it("data 里没有 items（或不是数组）时安全返回空，不抛错", () => {
    expect(
      collectItemContainers(blueprintWithStorage([{ name: "StorageComponent", data: {} }])),
    ).toEqual([]);
    expect(
      collectItemContainers(
        blueprintWithStorage([{ name: "StorageComponent", data: { items: "不是数组" } }]),
      ),
    ).toEqual([]);
  });

  it("缺 name / type 的物品被丢弃，不猜也不编", () => {
    const containers = collectItemContainers(
      blueprintWithStorage(
        storageWithItems([
          { type: "MaterialItem", count: 1 }, // 缺 name
          { name: "材料.没有类型" }, // 缺 type
          "根本不是对象",
          { name: "材料.旧麻绳", type: "MaterialItem", count: 3 },
        ]),
      ),
    );

    expect(containers[0]?.items.map((item) => item.name)).toEqual(["材料.旧麻绳"]);
  });

  it("count / description 缺失时给保守默认值", () => {
    const containers = collectItemContainers(
      blueprintWithStorage(storageWithItems([{ name: "材料.符纸残片", type: "MaterialItem" }])),
    );

    expect(containers[0]?.items[0]).toEqual({
      name: "材料.符纸残片",
      type: "MaterialItem",
      count: 1,
      description: "",
    });
  });
});
