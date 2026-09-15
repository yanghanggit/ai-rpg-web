import { describe, expect, it } from "vitest";
import { readCard } from "./readCard";

/** 一张字段齐全的卡：真实后端的 `Card` 载荷形状。 */
const cardFixture = {
  name: "卡.剖棺",
  description: "（mock）一刀剖开棺盖。",
  source: "角色.无名",
  cost: 2,
  damage: 3,
  hit_count: 2,
  block: 1,
  target_type: "single",
  self_target: false,
  on_play_affixes: ["[破甲]:本次出牌更容易击穿格挡"],
  on_hit_affixes: [],
  on_turn_end_affixes: [],
  playable: true,
  exhaust: false,
  retain: false,
  ethereal: false,
  uuid: "00000000-0000-0000-0000-0000000000c1",
};

describe("readCard", () => {
  it("读出全部展示字段（保留后端的 snake_case 字段名）", () => {
    const card = readCard(cardFixture);

    expect(card).toMatchObject({
      name: "卡.剖棺",
      cost: 2,
      damage: 3,
      hit_count: 2,
      block: 1,
      target_type: "single",
      self_target: false,
      playable: true,
      on_play_affixes: ["[破甲]:本次出牌更容易击穿格挡"],
      uuid: "00000000-0000-0000-0000-0000000000c1",
    });
  });

  it("缺省字段按后端默认值补（只给 name + target_type 也能读出来）", () => {
    const card = readCard({ name: "卡.轻击", target_type: "all" });

    expect(card).toMatchObject({
      name: "卡.轻击",
      description: "",
      source: "",
      cost: 1,
      damage: 0,
      hit_count: 1,
      block: 0,
      self_target: false,
      playable: true,
      on_play_affixes: [],
    });
  });

  it("没有名字、名字为空、target_type 不认识 → 丢掉（不猜）", () => {
    expect(readCard({ target_type: "single" })).toBeUndefined();
    expect(readCard({ name: "", target_type: "single" })).toBeUndefined();
    expect(readCard({ name: "卡.未知", target_type: "unknown" })).toBeUndefined();
    expect(readCard("卡.字符串不是卡")).toBeUndefined();
    expect(readCard(null)).toBeUndefined();
  });

  it("词缀只留非空字符串", () => {
    const card = readCard({
      name: "卡.杂",
      target_type: "spread",
      on_play_affixes: ["[a]:x", "", 42, null],
    });

    expect(card?.on_play_affixes).toEqual(["[a]:x"]);
  });

  it("uuid 缺失时为空字符串（界面不显示它，只当 key）", () => {
    expect(readCard({ name: "卡.无号", target_type: "single" })?.uuid).toBe("");
  });
});
