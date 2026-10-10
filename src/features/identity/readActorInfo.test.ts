import { describe, expect, it } from "vitest";
import { COMPONENT } from "../entities/componentNames";
import type { Entity } from "../entities/ecs";
import { readActorInfo } from "./readActorInfo";

const playerEntity: Entity = {
  name: "角色.零号",
  data: {
    [COMPONENT.Player]: { player_name: "webdev" },
    [COMPONENT.Identity]: { name: "角色.零号", creation_order: 2, entity_id: "id-1" },
    [COMPONENT.Appearance]: { name: "角色.零号", base_body: "基础身体", appearance: "当前外观" },
    [COMPONENT.CharacterStats]: {
      name: "角色.零号",
      stats: { hp: 12, max_hp: 15, attack: 3, defense: 1, lives: 3 },
    },
  },
};

describe("readActorInfo", () => {
  it("从组件里读出必要字段（玩家）", () => {
    expect(readActorInfo(playerEntity)).toEqual({
      player_name: "webdev",
      entity_id: "id-1",
      creation_order: 2,
      base_body: "基础身体",
      appearance: "当前外观",
      stats: { hp: 12, max_hp: 15, attack: 3, defense: 1, lives: 3 },
      incapacitated: false,
      worn_costume: null,
    });
  });

  it("NPC 没有 PlayerComponent，player_name 为 null（其余照常）", () => {
    const info = readActorInfo({
      name: "角色.螳螂",
      data: {
        [COMPONENT.Identity]: { name: "角色.螳螂", creation_order: 1, entity_id: "id-2" },
        [COMPONENT.CharacterStats]: {
          stats: { hp: 18, max_hp: 18, attack: 5, defense: 2, lives: 3 },
        },
      },
    });

    expect(info.player_name).toBeNull();
    expect(info.entity_id).toBe("id-2");
    expect(info.stats).toEqual({ hp: 18, max_hp: 18, attack: 5, defense: 2, lives: 3 });
    expect(info.incapacitated).toBe(false);
  });

  it("穿着时装时读出 WornCostumeComponent.item", () => {
    const info = readActorInfo({
      name: "角色.螳螂",
      data: {
        [COMPONENT.WornCostume]: {
          name: "角色.螳螂",
          item: {
            name: "时装.机能风衣",
            type: "CostumeItem",
            description: "深灰色的工装",
            count: 1,
          },
        },
      },
    });

    expect(info.worn_costume).toEqual({ name: "时装.机能风衣", description: "深灰色的工装" });
  });

  it("缺少组件时对应字段为 null（不猜）", () => {
    expect(readActorInfo({ name: "角色.零号", data: {} })).toEqual({
      player_name: null,
      entity_id: null,
      creation_order: null,
      base_body: null,
      appearance: null,
      stats: null,
      incapacitated: false,
      worn_costume: null,
    });
  });

  it("组件 data 字段缺失或类型不对时整段丢弃", () => {
    const entity: Entity = {
      name: "角色.零号",
      data: {
        [COMPONENT.Player]: { player_name: 123 },
        [COMPONENT.CharacterStats]: { stats: { hp: 12, max_hp: "15" } },
        [COMPONENT.WornCostume]: { item: { description: "没有名字" } },
      },
    };

    const info = readActorInfo(entity);
    expect(info.player_name).toBeNull();
    expect(info.stats).toBeNull();
    expect(info.worn_costume).toBeNull();
  });

  it("挂了 IncapacitatedComponent 时 incapacitated 为 true", () => {
    const info = readActorInfo({
      name: "角色.枯木",
      data: {
        [COMPONENT.Incapacitated]: { name: "角色.枯木" },
        [COMPONENT.CharacterStats]: {
          stats: { hp: 0, max_hp: 10, attack: 1, defense: 0, lives: 0 },
        },
      },
    });

    expect(info.incapacitated).toBe(true);
    expect(info.stats?.lives).toBe(0);
  });
});
