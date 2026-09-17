import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import {
  getComponent,
  getComponentData,
  hasComponent,
  isRecord,
  readBoolean,
  readCharacterStats,
  readNumber,
  readString,
} from "./ecs";

type Entity = Schemas["EntitySerialization"];

const entity: Entity = {
  name: "角色.无名",
  components: [
    { name: "PlayerComponent", data: { player_name: "webdev" } },
    {
      name: "CharacterStatsComponent",
      data: { name: "角色.无名", stats: { hp: 12, max_hp: 15, attack: 3, defense: 1 } },
    },
  ],
};

describe("isRecord", () => {
  it("对象为 true，其余为 false", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true); // 数组也是对象，取不到字段时由各 reader 丢弃
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(1)).toBe(false);
  });
});

describe("getComponent / getComponentData / hasComponent", () => {
  it("按类名取组件与 data", () => {
    expect(getComponent(entity, "PlayerComponent")).toEqual({
      name: "PlayerComponent",
      data: { player_name: "webdev" },
    });
    expect(getComponentData(entity, "PlayerComponent")).toEqual({ player_name: "webdev" });
    expect(getComponent(entity, "MissingComponent")).toBeUndefined();
    expect(getComponentData(entity, "MissingComponent")).toBeUndefined();
  });

  it("hasComponent 只判存在性", () => {
    expect(hasComponent(entity, "PlayerComponent")).toBe(true);
    expect(hasComponent(entity, "MonsterComponent")).toBe(false);
  });
});

describe("readString / readNumber / readBoolean", () => {
  const data = { name: "角色.无名", count: 3, flag: true, empty: "", bad: "x" };

  it("读出对应类型的字段", () => {
    expect(readString(data, "name")).toBe("角色.无名");
    expect(readNumber(data, "count")).toBe(3);
    expect(readBoolean(data, "flag")).toBe(true);
  });

  it("缺失 / 类型不对 / 空串返回 null", () => {
    expect(readString(data, "missing")).toBeNull();
    expect(readString(data, "empty")).toBeNull();
    expect(readNumber(data, "bad")).toBeNull();
    expect(readBoolean(data, "count")).toBeNull();
    expect(readNumber(undefined, "count")).toBeNull();
    expect(readString(null, "name")).toBeNull();
  });
});

describe("readCharacterStats", () => {
  it("读出 CharacterStatsComponent.stats", () => {
    expect(readCharacterStats(entity)).toEqual({ hp: 12, max_hp: 15, attack: 3, defense: 1 });
  });

  it("缺组件或字段类型不对返回 null（不猜）", () => {
    expect(readCharacterStats({ name: "角色.无名", components: [] })).toBeNull();
    expect(
      readCharacterStats({
        name: "角色.无名",
        components: [
          { name: "CharacterStatsComponent", data: { stats: { hp: 12, max_hp: "15" } } },
        ],
      }),
    ).toBeNull();
  });
});
