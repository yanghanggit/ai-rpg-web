import { describe, expect, it } from "vitest";
import { readCards } from "./readCards";

const card = { name: "卡.剖棺", target_type: "single", damage: 3 };

describe("readCards", () => {
  it("按组件名 + 字段读出牌组（DeckComponent）与奖励（SpoilsComponent）里的卡", () => {
    const components = [
      { name: "CharacterStatsComponent", data: { name: "角色.无名" } },
      { name: "DeckComponent", data: { name: "角色.无名", cards: [card] } },
      {
        name: "SpoilsComponent",
        data: { name: "角色.无名", candidate_cards: [card, card], claimed_cards: [card] },
      },
    ];

    expect(readCards(components, "DeckComponent")).toHaveLength(1);
    expect(readCards(components, "SpoilsComponent", "candidate_cards")).toHaveLength(2);
    expect(readCards(components, "SpoilsComponent", "claimed_cards")).toHaveLength(1);
  });

  it("组件缺失 / 字段不是数组 / 单张卡读不出来时安全降级", () => {
    expect(readCards([], "DeckComponent")).toEqual([]);
    expect(readCards([{ name: "DeckComponent", data: {} }], "DeckComponent")).toEqual([]);
    expect(
      readCards([{ name: "DeckComponent", data: { cards: "不是数组" } }], "DeckComponent"),
    ).toEqual([]);
    // Spoils 的字段名不同：用默认 cards 读不到，用 candidate_cards 才读到
    const spoils = [{ name: "SpoilsComponent", data: { candidate_cards: [card] } }];
    expect(readCards(spoils, "SpoilsComponent")).toEqual([]);
    expect(readCards(spoils, "SpoilsComponent", "claimed_cards")).toEqual([]);
    expect(readCards(spoils, "SpoilsComponent", "candidate_cards")).toHaveLength(1);
    // 读不出来的卡被丢掉，其余照常返回
    const components = [{ name: "DeckComponent", data: { cards: [card, { name: "坏卡" }] } }];
    expect(readCards(components, "DeckComponent")).toHaveLength(1);
  });
});
