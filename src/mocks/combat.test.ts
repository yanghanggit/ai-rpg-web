import { describe, expect, it } from "vitest";
import { COMPONENT } from "../features/entities/componentNames";
import type { Entity } from "../features/entities/ecs";
import {
  advanceMockMonsterTurn,
  collectMockLoot,
  completeMockRound,
  drawMockCards,
  equipMockGear,
  initMockCombat,
  passMockTurn,
  playMockCards,
  prepareMockDefeat,
  prepareMockPostCombat,
  readMockCombat,
  readMockCombatActorEntity,
  readMockCombatLoot,
  readMockCombatParticipants,
  retreatMockCombat,
  useMockConsumable,
  withMockCombatComponents,
} from "./combat";
import { advanceMockDungeon, enterMockDungeon } from "./dungeons";
import { blueprintFixture } from "./fixtures";
import { readMockActorEntity } from "./items";
import { withMockOpeningComponents } from "./opening";
import { readMockStages } from "./stages";

const PLAYER = blueprintFixture.player_actor;
const MONSTER_1 = "怪物.石像鬼";
const MONSTER_2 = "怪物.腐沼巨蜥";
const MONSTER_3 = "怪物.提线木偶";
const COMBAT_STAGE = "场景.地窟深处";

/** 进入副本并推进到战斗房间：队伍固化 + 战斗复位为 INITIALIZATION。 */
function enterCombat(): void {
  enterMockDungeon("副本.荒废地窟");
  advanceMockDungeon();
}

function actorEntity(name: string): Entity {
  const entity = readMockActorEntity(name);
  if (entity === null) {
    throw new Error(`找不到角色实体：${name}`);
  }
  return withMockCombatComponents(withMockOpeningComponents(entity));
}

function monsterEntity(name: string): Entity {
  const entity = readMockCombatActorEntity(name);
  if (entity === null) {
    throw new Error(`找不到怪物实体：${name}`);
  }
  return withMockCombatComponents(entity);
}

function componentData(entity: Entity, name: string): Record<string, unknown> | undefined {
  return entity.data[name];
}

describe("进入战斗房间", () => {
  it("战斗复位为 INITIALIZATION，参战者 = 队伍 + 怪物", () => {
    enterCombat();
    expect(readMockCombat().state).toBe(1);
    expect(readMockCombat().rounds).toEqual([]);
    expect(readMockCombatParticipants()).toEqual([PLAYER, MONSTER_1, MONSTER_2, MONSTER_3]);
  });

  it("队伍与怪物被搬进战斗场景，队伍离开家园场景", () => {
    enterCombat();
    const actorsByStage = readMockStages().actors_by_stage;
    expect(actorsByStage[COMBAT_STAGE]).toEqual([PLAYER, MONSTER_1, MONSTER_2, MONSTER_3]);
    expect(actorsByStage["场景.佣兵公会"]).not.toContain(PLAYER);
  });
});

describe("初始化 / 抓牌", () => {
  it("初始化把 INITIALIZATION 推进到 ONGOING", () => {
    enterCombat();
    expect(initMockCombat()).toEqual({ ok: true, message: "战斗初始化完成" });
    expect(readMockCombat().state).toBe(2);
    // 重复初始化被拒
    expect(initMockCombat().ok).toBe(false);
  });

  it("抓牌开新回合、填手牌并给能量", () => {
    enterCombat();
    initMockCombat();

    expect(drawMockCards()).toMatchObject({ ok: true });
    const round = readMockCombat().rounds[0];
    expect(round?.draw_completed).toBe(true);
    expect(round?.current_actor).toBe(PLAYER);
    expect(round?.action_order).toEqual([PLAYER, MONSTER_1, MONSTER_2, MONSTER_3]);
    // 同一回合不能重复抓牌
    expect(drawMockCards().ok).toBe(false);
  });

  it("第 2 回合：上一回合手牌进弃牌堆，抽牌堆空了洗回（不出现空手牌）", () => {
    enterCombat();
    initMockCombat();
    drawMockCards();
    expect(completeMockRound()).toBe(true);

    expect(drawMockCards()).toMatchObject({ ok: true });
    const hand = componentData(actorEntity(PLAYER), COMPONENT.Hand)?.cards ?? [];
    expect(hand).toHaveLength(5);
    expect(readMockCombat().rounds).toHaveLength(2);
  });
});

describe("回合行动", () => {
  function startRound(): void {
    enterCombat();
    initMockCombat();
    drawMockCards();
  }

  it("出牌记日志 / 叙事并把卡从手牌移到弃牌堆", () => {
    startRound();
    expect(componentData(actorEntity(PLAYER), COMPONENT.Hand)?.cards).toHaveLength(5);

    expect(playMockCards(PLAYER, "劈斩", [MONSTER_1])).toMatchObject({ ok: true });
    const round = readMockCombat().rounds[0];
    expect(round?.entries).toHaveLength(1);
    expect(round?.entries[0]?.kind).toBe("cards");
    expect(round?.entries[0]?.log).toBeTruthy();
    expect(round?.entries[0]?.narrative).toBeTruthy();

    const after = actorEntity(PLAYER);
    expect(componentData(after, COMPONENT.Hand)?.cards).toHaveLength(4);
    expect(componentData(after, COMPONENT.DiscardPile)?.cards).toHaveLength(1);
  });

  it("手牌里没有的卡无法打出", () => {
    startRound();
    expect(playMockCards(PLAYER, "不存在的卡", [MONSTER_1]).ok).toBe(false);
  });

  it("消耗品先扣库存、物化为手牌；装备记日志并累加次数", () => {
    startRound();
    expect(componentData(actorEntity(PLAYER), COMPONENT.Hand)?.cards).toHaveLength(5);

    expect(useMockConsumable("消耗品.治疗药水")).toMatchObject({ ok: true });
    expect(equipMockGear("装备.短斧")).toMatchObject({ ok: true });
    const round = readMockCombat().rounds[0];
    const entries = round?.entries ?? [];
    expect(entries.filter((entry) => entry.kind === "consumable")).toHaveLength(1);
    expect(entries.filter((entry) => entry.kind === "gear")).toHaveLength(1);
    // 治疗药水 count=2 → 物化 2 张手牌
    expect(componentData(actorEntity(PLAYER), COMPONENT.Hand)?.cards).toHaveLength(7);
  });

  it("背包里没有的消耗品无法使用", () => {
    startRound();
    expect(useMockConsumable("消耗品.不存在").ok).toBe(false);
  });

  it("过牌推进到下一个角色，全员行动完后结束回合", () => {
    startRound();
    expect(passMockTurn()).toMatchObject({ ok: true });
    expect(readMockCombat().rounds[0]?.current_actor).toBe(MONSTER_1);
  });

  it("推进怪物回合会记日志并结束该角色回合", () => {
    startRound();
    passMockTurn(); // 让怪物成为 current_actor
    expect(advanceMockMonsterTurn()).toMatchObject({ ok: true });
    expect(readMockCombat().rounds[0]?.current_actor).toBe(MONSTER_2);
    expect(readMockCombat().rounds[0]?.entries).toHaveLength(1);
  });
});

describe("结算 / 战利品", () => {
  it("prepareMockPostCombat 直接给出胜利结算 + 战利品 + 怪物已战死", () => {
    enterCombat();
    initMockCombat();
    prepareMockPostCombat();

    expect(readMockCombat().state).toBe(4);
    expect(readMockCombat().result).toBe(1);
    expect(readMockCombatLoot()).toHaveLength(1);

    expect(monsterEntity(MONSTER_1).data[COMPONENT.Death]).toBeDefined();
    expect(actorEntity(PLAYER).data[COMPONENT.Loot]).toBeDefined();
  });

  it("prepareMockDefeat 给出战败结算：我方全灭、怪物存活、无战利品", () => {
    enterCombat();
    initMockCombat();
    prepareMockDefeat();

    expect(readMockCombat().state).toBe(4);
    expect(readMockCombat().result).toBe(2);
    expect(readMockCombatLoot()).toEqual([]);

    // 我方全灭：队伍成员都带上了 DeathComponent（对应服务端 `_is_player_side_eliminated`）
    expect(actorEntity(PLAYER).data[COMPONENT.Death]).toBeDefined();
    expect(monsterEntity(MONSTER_1).data[COMPONENT.Death]).toBeUndefined();
    expect(actorEntity(PLAYER).data[COMPONENT.Loot]).toBeUndefined();
  });

  it("收取战利品：没有时拒绝，有则清空", () => {
    enterCombat();
    expect(collectMockLoot().ok).toBe(false);
    initMockCombat();
    prepareMockPostCombat();
    expect(collectMockLoot()).toMatchObject({ ok: true });
    expect(readMockCombatLoot()).toEqual([]);
    expect(collectMockLoot().ok).toBe(false);
  });

  it("撤退只在 ONGOING 可用，并以失败结算", () => {
    enterCombat();
    expect(retreatMockCombat().ok).toBe(false);
    initMockCombat();
    expect(retreatMockCombat()).toMatchObject({ ok: true });
    expect(readMockCombat().state).toBe(4);
    expect(readMockCombat().retreated).toBe(true);
    expect(readMockCombat().result).toBe(2);
  });
});
