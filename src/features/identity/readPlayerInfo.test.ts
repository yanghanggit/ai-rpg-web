import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import { readPlayerInfo } from "./readPlayerInfo";

type Entity = Schemas["EntitySerialization"];

const fullEntity: Entity = {
  name: "角色.无名",
  components: [
    { name: "PlayerComponent", data: { player_name: "webdev" } },
    {
      name: "IdentityComponent",
      data: { name: "角色.无名", creation_order: 2, entity_id: "id-1" },
    },
    {
      name: "AppearanceComponent",
      data: { name: "角色.无名", base_body: "基础身体", appearance: "当前外观" },
    },
    {
      name: "CharacterStatsComponent",
      data: { name: "角色.无名", stats: { hp: 12, max_hp: 15, attack: 3, defense: 1 } },
    },
  ],
};

describe("readPlayerInfo", () => {
  it("从四个组件里读出必要字段", () => {
    expect(readPlayerInfo(fullEntity)).toEqual({
      player_name: "webdev",
      entity_id: "id-1",
      creation_order: 2,
      base_body: "基础身体",
      appearance: "当前外观",
      stats: { hp: 12, max_hp: 15, attack: 3, defense: 1 },
    });
  });

  it("缺少组件时对应字段为 null（不猜）", () => {
    expect(readPlayerInfo({ name: "角色.无名", components: [] })).toEqual({
      player_name: null,
      entity_id: null,
      creation_order: null,
      base_body: null,
      appearance: null,
      stats: null,
    });
  });

  it("组件 data 字段缺失或类型不对时整段丢弃", () => {
    const entity: Entity = {
      name: "角色.无名",
      components: [
        { name: "PlayerComponent", data: { player_name: 123 } },
        { name: "CharacterStatsComponent", data: { stats: { hp: 12, max_hp: "15" } } },
      ],
    };

    const info = readPlayerInfo(entity);
    expect(info.player_name).toBeNull();
    expect(info.stats).toBeNull();
  });
});
