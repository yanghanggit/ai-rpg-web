import { describe, expect, it } from "vitest";
import type { Card } from "../../cards/types";
import type { DungeonPartyMember } from "../useDungeonParty";
import { hasUnclaimedRewards } from "./hasUnclaimedRewards";

const card: Card = {
  uuid: "",
  name: "火折子",
  cost: 1,
  damage: 0,
  block: 0,
  hit_count: 1,
  description: "",
  playable: true,
  exhaust: false,
  retain: false,
  ethereal: false,
  self_target: false,
  target_type: "single",
  on_play_affixes: [],
  on_hit_affixes: [],
  on_turn_end_affixes: [],
  source: "",
};

function member(claimedCards: Card[] | null, candidateCards: Card[] = [card]): DungeonPartyMember {
  return {
    name: "角色.无名",
    player: true,
    stats: null,
    deck: [],
    spoils: claimedCards === null ? null : { candidateCards, claimedCards },
  };
}

describe("hasUnclaimedRewards", () => {
  it("还没生成奖励（没有 SpoilsComponent）→ 不是「没领」", () => {
    expect(hasUnclaimedRewards(member(null))).toBe(false);
  });

  it("候选还有、一张都没领 → 是", () => {
    expect(hasUnclaimedRewards(member([]))).toBe(true);
  });

  it("已经领过（候选保留供回看）→ 不再是", () => {
    expect(hasUnclaimedRewards(member([card]))).toBe(false);
  });

  it("候选是空的 → 没有可领的东西，不算「没领」", () => {
    expect(hasUnclaimedRewards(member([], []))).toBe(false);
  });
});
