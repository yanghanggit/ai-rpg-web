import { describe, expect, it } from "vitest";
import { readCards } from "./readCards";

const card = { name: "卡.剖棺", target_type: "single", damage: 3 };

describe("readCards", () => {
  it("按组件名读出牌组 / 卡池里的卡", () => {
    const components = [
      { name: "CharacterStatsComponent", data: { name: "角色.无名" } },
      { name: "DeckComponent", data: { name: "角色.无名", cards: [card] } },
      { name: "SpoilsComponent", data: { name: "角色.无名", cards: [card, card] } },
    ];

    expect(readCards(components, "DeckComponent")).toHaveLength(1);
    expect(readCards(components, "SpoilsComponent")).toHaveLength(2);
  });

  it("组件缺失 / cards 不是数组 / 单张卡读不出来时安全降级", () => {
    expect(readCards([], "DeckComponent")).toEqual([]);
    expect(readCards([{ name: "DeckComponent", data: {} }], "DeckComponent")).toEqual([]);
    expect(
      readCards([{ name: "DeckComponent", data: { cards: "不是数组" } }], "DeckComponent"),
    ).toEqual([]);
    // 读不出来的卡被丢掉，其余照常返回
    const components = [{ name: "DeckComponent", data: { cards: [card, { name: "坏卡" }] } }];
    expect(readCards(components, "DeckComponent")).toHaveLength(1);
  });
});
