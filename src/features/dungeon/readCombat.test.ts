import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import { cardFixtures } from "../../mocks/fixtures";
import {
  classifyFaction,
  computeHandBlock,
  isDead,
  isPlayer,
  readCombatant,
  readEnergy,
  readHand,
  readPiles,
} from "./readCombat";

type Entity = Schemas["EntitySerialization"];
type Components = Schemas["ComponentSerialization"][];

function entity(name: string, components: Components = []): Entity {
  return { name, components };
}

describe("classifyFaction", () => {
  it("玩家 / NPC → party，怪物 → monster，其余 unknown", () => {
    expect(classifyFaction(entity("角色.无名", [{ name: "PlayerComponent", data: {} }]))).toBe(
      "party",
    );
    expect(classifyFaction(entity("角色.顾知秋", [{ name: "NPCComponent", data: {} }]))).toBe(
      "party",
    );
    expect(classifyFaction(entity("怪物.纸人", [{ name: "MonsterComponent", data: {} }]))).toBe(
      "monster",
    );
    expect(classifyFaction(entity("场景.停柩房", []))).toBe("unknown");
  });
});

describe("isDead / isPlayer", () => {
  it("DeathComponent / PlayerComponent 只判存在性", () => {
    expect(isDead(entity("角色.无名", [{ name: "DeathComponent", data: {} }]))).toBe(true);
    expect(isDead(entity("角色.无名", []))).toBe(false);
    expect(isPlayer(entity("角色.无名", [{ name: "PlayerComponent", data: {} }]))).toBe(true);
    expect(isPlayer(entity("角色.顾知秋", [{ name: "NPCComponent", data: {} }]))).toBe(false);
  });
});

describe("readEnergy", () => {
  it("读出 RoundStatsComponent.energy", () => {
    const e = entity("角色.无名", [
      { name: "RoundStatsComponent", data: { name: "角色.无名", energy: 3 } },
    ]);
    expect(readEnergy(e)).toBe(3);
  });

  it("缺组件或字段类型不对时为 0", () => {
    expect(readEnergy(entity("角色.无名", []))).toBe(0);
    const broken = entity("角色.无名", [{ name: "RoundStatsComponent", data: { energy: "3" } }]);
    expect(readEnergy(broken)).toBe(0);
  });
});

describe("readHand / computeHandBlock", () => {
  it("读出合法手牌并过滤坏卡", () => {
    const e = entity("角色.无名", [
      {
        name: "HandComponent",
        data: { name: "角色.无名", cards: [cardFixtures.cleave, { name: "坏卡" }] },
      },
    ]);
    const hand = readHand(e);
    expect(hand.map((card) => card.name)).toEqual(["剖棺"]);
  });

  it("未抓牌（无 HandComponent）时为空数组", () => {
    expect(readHand(entity("角色.无名", []))).toEqual([]);
  });

  it("总格挡 = 手牌 block 求和", () => {
    const hand = readHand(
      entity("角色.无名", [
        {
          name: "HandComponent",
          data: {
            name: "角色.无名",
            cards: [cardFixtures.breath, cardFixtures.ward, cardFixtures.cleave],
          },
        },
      ]),
    );
    // 屏息 block 3 + 镇棺符 block 2 + 剖棺 block 0
    expect(computeHandBlock(hand)).toBe(5);
  });
});

describe("readPiles", () => {
  it("数出抽牌 / 弃牌 / 消耗堆张数", () => {
    const e = entity("角色.无名", [
      { name: "DrawPileComponent", data: { cards: [cardFixtures.cleave, cardFixtures.breath] } },
      { name: "DiscardPileComponent", data: { cards: [cardFixtures.ward] } },
      { name: "ExhaustPileComponent", data: { cards: [] } },
    ]);
    expect(readPiles(e)).toEqual({ draw: 2, discard: 1, exhaust: 0 });
  });

  it("无牌堆组件时全为 0", () => {
    expect(readPiles(entity("角色.无名", []))).toEqual({ draw: 0, discard: 0, exhaust: 0 });
  });
});

describe("readCombatant", () => {
  it("一次读全参战角色的界面字段", () => {
    const e = entity("角色.无名", [
      { name: "PlayerComponent", data: { player_name: "webdev" } },
      {
        name: "CharacterStatsComponent",
        data: { stats: { hp: 12, max_hp: 18, attack: 3, defense: 1 } },
      },
      { name: "RoundStatsComponent", data: { energy: 3 } },
      {
        name: "HandComponent",
        data: { cards: [cardFixtures.breath, cardFixtures.ward] },
      },
      { name: "DrawPileComponent", data: { cards: [cardFixtures.cleave] } },
      { name: "DiscardPileComponent", data: { cards: [] } },
      { name: "ExhaustPileComponent", data: { cards: [cardFixtures.spark] } },
    ]);

    expect(readCombatant(e)).toEqual({
      name: "角色.无名",
      faction: "party",
      player: true,
      dead: false,
      stats: { hp: 12, max_hp: 18, attack: 3, defense: 1 },
      energy: 3,
      hand: [
        expect.objectContaining({ name: "屏息" }),
        expect.objectContaining({ name: "镇棺符" }),
      ],
      block: 5,
      piles: { draw: 1, discard: 0, exhaust: 1 },
    });
  });

  it("怪物没有玩家 / 手牌组件时给出安全默认值", () => {
    const e = entity("怪物.纸人", [
      { name: "MonsterComponent", data: {} },
      {
        name: "CharacterStatsComponent",
        data: { stats: { hp: 9, max_hp: 9, attack: 3, defense: 1 } },
      },
    ]);
    expect(readCombatant(e)).toEqual({
      name: "怪物.纸人",
      faction: "monster",
      player: false,
      dead: false,
      stats: { hp: 9, max_hp: 9, attack: 3, defense: 1 },
      energy: 0,
      hand: [],
      block: 0,
      piles: { draw: 0, discard: 0, exhaust: 0 },
    });
  });
});
