import { describe, expect, it } from "vitest";
import { cardFixtures } from "../../../mocks/fixtures";
import { COMPONENT } from "../../entities/componentNames";
import type { Entity, EntityData } from "../../entities/ecs";
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

function entity(name: string, data: EntityData = {}): Entity {
  return { name, data };
}

describe("classifyFaction", () => {
  it("玩家 / NPC → party，怪物 → monster，其余 unknown", () => {
    expect(classifyFaction(entity("角色.零号", { [COMPONENT.Player]: {} }))).toBe("party");
    expect(classifyFaction(entity("角色.螳螂", { [COMPONENT.NPC]: {} }))).toBe("party");
    expect(classifyFaction(entity("怪物.门神", { [COMPONENT.Monster]: {} }))).toBe("monster");
    expect(classifyFaction(entity("场景.残骸核心"))).toBe("unknown");
  });
});

describe("isDead / isPlayer", () => {
  it("DeathComponent / PlayerComponent 只判存在性", () => {
    expect(isDead(entity("角色.零号", { [COMPONENT.Death]: {} }))).toBe(true);
    expect(isDead(entity("角色.零号"))).toBe(false);
    expect(isPlayer(entity("角色.零号", { [COMPONENT.Player]: {} }))).toBe(true);
    expect(isPlayer(entity("角色.螳螂", { [COMPONENT.NPC]: {} }))).toBe(false);
  });
});

describe("readEnergy", () => {
  it("读出 RoundStatsComponent.energy", () => {
    const e = entity("角色.零号", {
      [COMPONENT.RoundStats]: { name: "角色.零号", energy: 3 },
    });
    expect(readEnergy(e)).toBe(3);
  });

  it("缺组件或字段类型不对时为 0", () => {
    expect(readEnergy(entity("角色.零号"))).toBe(0);
    const broken = entity("角色.零号", { [COMPONENT.RoundStats]: { energy: "3" } });
    expect(readEnergy(broken)).toBe(0);
  });
});

describe("readHand / computeHandBlock", () => {
  it("读出合法手牌并过滤坏卡", () => {
    const e = entity("角色.零号", {
      [COMPONENT.Hand]: { name: "角色.零号", cards: [cardFixtures.cleave, { name: "坏卡" }] },
    });
    const hand = readHand(e);
    expect(hand.map((card) => card.name)).toEqual(["破译"]);
  });

  it("未抓牌（无 HandComponent）时为空数组", () => {
    expect(readHand(entity("角色.零号"))).toEqual([]);
  });

  it("总格挡 = 手牌 block 求和", () => {
    const hand = readHand(
      entity("角色.零号", {
        [COMPONENT.Hand]: {
          name: "角色.零号",
          cards: [cardFixtures.breath, cardFixtures.ward, cardFixtures.cleave],
        },
      }),
    );
    // 静默 block 3 + 冰墙 block 2 + 破译 block 0
    expect(computeHandBlock(hand)).toBe(5);
  });
});

describe("readPiles", () => {
  it("读出抽牌 / 弃牌 / 消耗堆里的牌（顺序照抄服务端）", () => {
    const e = entity("角色.零号", {
      [COMPONENT.DrawPile]: { cards: [cardFixtures.cleave, cardFixtures.breath] },
      [COMPONENT.DiscardPile]: { cards: [cardFixtures.ward] },
      [COMPONENT.ExhaustPile]: { cards: [] },
    });
    const piles = readPiles(e);
    expect(piles.draw.map((card) => card.name)).toEqual(["破译", "静默"]);
    expect(piles.discard.map((card) => card.name)).toEqual(["冰墙"]);
    expect(piles.exhaust).toEqual([]);
  });

  it("无牌堆组件时三个堆都为空", () => {
    expect(readPiles(entity("角色.零号"))).toEqual({ draw: [], discard: [], exhaust: [] });
  });
});

describe("readCombatant", () => {
  it("一次读全参战角色的界面字段", () => {
    const e = entity("角色.零号", {
      [COMPONENT.Player]: { player_name: "webdev" },
      [COMPONENT.CharacterStats]: { stats: { hp: 12, max_hp: 18, attack: 3, defense: 1 } },
      [COMPONENT.RoundStats]: { energy: 3 },
      [COMPONENT.Hand]: { cards: [cardFixtures.breath, cardFixtures.ward] },
      [COMPONENT.DrawPile]: { cards: [cardFixtures.cleave] },
      [COMPONENT.DiscardPile]: { cards: [] },
      [COMPONENT.ExhaustPile]: { cards: [cardFixtures.spark] },
    });

    expect(readCombatant(e)).toEqual({
      name: "角色.零号",
      faction: "party",
      player: true,
      dead: false,
      stats: { hp: 12, max_hp: 18, attack: 3, defense: 1 },
      energy: 3,
      hand: [expect.objectContaining({ name: "静默" }), expect.objectContaining({ name: "冰墙" })],
      block: 5,
      piles: {
        draw: [expect.objectContaining({ name: "破译" })],
        discard: [],
        exhaust: [expect.objectContaining({ name: "短路" })],
      },
    });
  });

  it("怪物没有玩家 / 手牌组件时给出安全默认值", () => {
    const e = entity("怪物.门神", {
      [COMPONENT.Monster]: {},
      [COMPONENT.CharacterStats]: { stats: { hp: 9, max_hp: 9, attack: 3, defense: 1 } },
    });
    expect(readCombatant(e)).toEqual({
      name: "怪物.门神",
      faction: "monster",
      player: false,
      dead: false,
      stats: { hp: 9, max_hp: 9, attack: 3, defense: 1 },
      energy: 0,
      hand: [],
      block: 0,
      piles: { draw: [], discard: [], exhaust: [] },
    });
  });
});
