import { describe, expect, it } from "vitest";
import { COMPONENT, type ComponentName } from "./componentNames";
import {
  type Entity,
  getComponentData,
  hasComponent,
  isRecord,
  readBoolean,
  readCharacterStats,
  readEquippedGearSpeed,
  readNumber,
  readString,
} from "./ecs";

const entity: Entity = {
  name: "角色.无名",
  data: {
    [COMPONENT.Player]: { player_name: "webdev" },
    [COMPONENT.CharacterStats]: {
      name: "角色.无名",
      stats: { hp: 12, max_hp: 15, attack: 3, defense: 1, speed: 4 },
    },
  },
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

describe("getComponentData / hasComponent", () => {
  it("按类名取 data", () => {
    expect(getComponentData(entity, COMPONENT.Player)).toEqual({ player_name: "webdev" });
    expect(getComponentData(entity, "MissingComponent" as ComponentName)).toBeUndefined();
  });

  it("hasComponent 只判存在性", () => {
    expect(hasComponent(entity, COMPONENT.Player)).toBe(true);
    expect(hasComponent(entity, COMPONENT.Monster)).toBe(false);
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
    expect(readCharacterStats(entity)).toEqual({
      hp: 12,
      max_hp: 15,
      attack: 3,
      defense: 1,
      speed: 4,
    });
  });

  it("缺组件或字段类型不对返回 null（不猜）", () => {
    expect(readCharacterStats({ name: "角色.无名", data: {} })).toBeNull();
    expect(
      readCharacterStats({
        name: "角色.无名",
        data: { [COMPONENT.CharacterStats]: { stats: { hp: 12, max_hp: "15" } } },
      }),
    ).toBeNull();
  });

  it("把 EquippedGearComponent 的 speed 叠加进有效速度", () => {
    expect(
      readCharacterStats({
        name: "角色.无名",
        data: {
          [COMPONENT.CharacterStats]: {
            stats: { hp: 12, max_hp: 15, attack: 3, defense: 1, speed: 4 },
          },
          [COMPONENT.EquippedGear]: {
            name: "角色.无名",
            items: [{ speed: 2 }, { speed: -1 }],
          },
        },
      }),
    ).toEqual({ hp: 12, max_hp: 15, attack: 3, defense: 1, speed: 5 });
  });
});

describe("readEquippedGearSpeed", () => {
  it("无组件时返回 0", () => {
    expect(readEquippedGearSpeed(entity)).toBe(0);
  });

  it("累加各装备 speed；条目缺 speed 或结构异常时跳过（不猜）", () => {
    expect(
      readEquippedGearSpeed({
        name: "角色.无名",
        data: {
          [COMPONENT.EquippedGear]: {
            name: "角色.无名",
            items: [{ speed: 2 }, { speed: -1 }, { other: true }, null],
          },
        },
      }),
    ).toBe(1);
  });
});
