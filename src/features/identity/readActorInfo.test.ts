import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import { COMPONENT } from "../entities/componentNames";
import { readActorInfo } from "./readActorInfo";

type Entity = Schemas["EntitySerialization"];

const playerEntity: Entity = {
  name: "角色.无名",
  components: [
    { name: COMPONENT.Player, data: { player_name: "webdev" } },
    {
      name: COMPONENT.Identity,
      data: { name: "角色.无名", creation_order: 2, entity_id: "id-1" },
    },
    {
      name: COMPONENT.Appearance,
      data: { name: "角色.无名", base_body: "基础身体", appearance: "当前外观" },
    },
    {
      name: COMPONENT.CharacterStats,
      data: { name: "角色.无名", stats: { hp: 12, max_hp: 15, attack: 3, defense: 1 } },
    },
  ],
};

describe("readActorInfo", () => {
  it("从组件里读出必要字段（玩家）", () => {
    expect(readActorInfo(playerEntity)).toEqual({
      player_name: "webdev",
      entity_id: "id-1",
      creation_order: 2,
      base_body: "基础身体",
      appearance: "当前外观",
      stats: { hp: 12, max_hp: 15, attack: 3, defense: 1 },
      worn_costume: null,
    });
  });

  it("NPC 没有 PlayerComponent，player_name 为 null（其余照常）", () => {
    const info = readActorInfo({
      name: "角色.顾知秋",
      components: [
        {
          name: COMPONENT.Identity,
          data: { name: "角色.顾知秋", creation_order: 1, entity_id: "id-2" },
        },
        {
          name: COMPONENT.CharacterStats,
          data: { stats: { hp: 18, max_hp: 18, attack: 5, defense: 2 } },
        },
      ],
    });

    expect(info.player_name).toBeNull();
    expect(info.entity_id).toBe("id-2");
    expect(info.stats).toEqual({ hp: 18, max_hp: 18, attack: 5, defense: 2 });
  });

  it("穿着时装时读出 WornCostumeComponent.item", () => {
    const info = readActorInfo({
      name: "角色.顾知秋",
      components: [
        {
          name: COMPONENT.WornCostume,
          data: {
            name: "角色.顾知秋",
            item: { name: "时装.朱砂袍", type: "CostumeItem", description: "绯色道袍", count: 1 },
          },
        },
      ],
    });

    expect(info.worn_costume).toEqual({ name: "时装.朱砂袍", description: "绯色道袍" });
  });

  it("缺少组件时对应字段为 null（不猜）", () => {
    expect(readActorInfo({ name: "角色.无名", components: [] })).toEqual({
      player_name: null,
      entity_id: null,
      creation_order: null,
      base_body: null,
      appearance: null,
      stats: null,
      worn_costume: null,
    });
  });

  it("组件 data 字段缺失或类型不对时整段丢弃", () => {
    const entity: Entity = {
      name: "角色.无名",
      components: [
        { name: COMPONENT.Player, data: { player_name: 123 } },
        { name: COMPONENT.CharacterStats, data: { stats: { hp: 12, max_hp: "15" } } },
        { name: COMPONENT.WornCostume, data: { item: { description: "没有名字" } } },
      ],
    };

    const info = readActorInfo(entity);
    expect(info.player_name).toBeNull();
    expect(info.stats).toBeNull();
    expect(info.worn_costume).toBeNull();
  });
});
