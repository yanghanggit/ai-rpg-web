import { describe, expect, it } from "vitest";
import { COMPONENT } from "../entities/componentNames";
import type { Entity } from "../entities/ecs";
import { readCards } from "./readCards";

const card = { name: "卡.破译", target_type: "single", damage: 3 };

function entityWith(data: Entity["data"]): Entity {
  return { name: "角色.零号", data };
}

describe("readCards", () => {
  it("按组件名 + 字段读出牌组（DeckComponent）与奖励（SpoilsComponent）里的卡", () => {
    const entity = entityWith({
      [COMPONENT.CharacterStats]: { name: "角色.零号" },
      [COMPONENT.Deck]: { name: "角色.零号", cards: [card] },
      [COMPONENT.Spoils]: {
        name: "角色.零号",
        candidate_cards: [card, card],
        claimed_cards: [card],
      },
    });

    expect(readCards(entity, COMPONENT.Deck)).toHaveLength(1);
    expect(readCards(entity, COMPONENT.Spoils, "candidate_cards")).toHaveLength(2);
    expect(readCards(entity, COMPONENT.Spoils, "claimed_cards")).toHaveLength(1);
  });

  it("组件缺失 / 字段不是数组 / 单张卡读不出来时安全降级", () => {
    expect(readCards(entityWith({}), COMPONENT.Deck)).toEqual([]);
    expect(readCards(entityWith({ [COMPONENT.Deck]: {} }), COMPONENT.Deck)).toEqual([]);
    expect(
      readCards(entityWith({ [COMPONENT.Deck]: { cards: "不是数组" } }), COMPONENT.Deck),
    ).toEqual([]);
    // Spoils 的字段名不同：用默认 cards 读不到，用 candidate_cards 才读到
    const spoils = entityWith({ [COMPONENT.Spoils]: { candidate_cards: [card] } });
    expect(readCards(spoils, COMPONENT.Spoils)).toEqual([]);
    expect(readCards(spoils, COMPONENT.Spoils, "claimed_cards")).toEqual([]);
    expect(readCards(spoils, COMPONENT.Spoils, "candidate_cards")).toHaveLength(1);
    // 读不出来的卡被丢掉，其余照常返回
    const mixed = entityWith({ [COMPONENT.Deck]: { cards: [card, { name: "坏卡" }] } });
    expect(readCards(mixed, COMPONENT.Deck)).toHaveLength(1);
  });
});
