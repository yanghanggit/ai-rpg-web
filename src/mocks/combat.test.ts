import { describe, expect, it } from "vitest";
import type { Schemas } from "../api/types";
import { COMPONENT } from "../features/entities/componentNames";
import {
  advanceMockMonsterTurn,
  collectMockLoot,
  drawMockCards,
  equipMockGear,
  initMockCombat,
  passMockTurn,
  playMockCards,
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

type Entity = Schemas["EntitySerialization"];

const PLAYER = blueprintFixture.player_actor;
const MONSTER_1 = "怪物.纸人";
const MONSTER_2 = "怪物.棺中殭尸";
const MONSTER_3 = "怪物.纸傀儡";
const MONSTER_4 = "怪物.吊死鬼";
const COMBAT_STAGE = "场景.停柩房";

/** 进入副本并推进到战斗房间：队伍固化 + 战斗复位为 INITIALIZATION。 */
function enterCombat(): void {
  enterMockDungeon("副本.荒村义庄");
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
  return entity.components.find((component) => component.name === name)?.data;
}

describe("进入战斗房间", () => {
  it("战斗复位为 INITIALIZATION，参战者 = 队伍 + 怪物", () => {
    enterCombat();
    expect(readMockCombat().state).toBe(1);
    expect(readMockCombat().rounds).toEqual([]);
    expect(readMockCombatParticipants()).toEqual([
      PLAYER,
      MONSTER_1,
      MONSTER_2,
      MONSTER_3,
      MONSTER_4,
    ]);
  });

  it("队伍与怪物被搬进战斗场景，队伍离开家园场景", () => {
    enterCombat();
    const actorsByStage = readMockStages().actors_by_stage;
    expect(actorsByStage[COMBAT_STAGE]).toEqual([
      PLAYER,
      MONSTER_1,
      MONSTER_2,
      MONSTER_3,
      MONSTER_4,
    ]);
    expect(actorsByStage["场景.门厅"]).not.toContain(PLAYER);
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
    expect(round?.action_order).toEqual([PLAYER, MONSTER_1, MONSTER_2, MONSTER_3, MONSTER_4]);
    // 同一回合不能重复抓牌
    expect(drawMockCards().ok).toBe(false);
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

    expect(playMockCards(PLAYER, "剖棺", [MONSTER_1])).toMatchObject({ ok: true });
    const round = readMockCombat().rounds[0];
    expect(round?.cards_log).toHaveLength(1);
    expect(round?.cards_narrative).toHaveLength(1);

    const after = actorEntity(PLAYER);
    expect(componentData(after, COMPONENT.Hand)?.cards).toHaveLength(4);
    expect(componentData(after, COMPONENT.DiscardPile)?.cards).toHaveLength(1);
  });

  it("手牌里没有的卡无法打出", () => {
    startRound();
    expect(playMockCards(PLAYER, "不存在的卡", [MONSTER_1]).ok).toBe(false);
  });

  it("消耗品 / 装备记日志并累加次数", () => {
    startRound();
    expect(useMockConsumable("消耗品.回气散", [PLAYER])).toMatchObject({ ok: true });
    expect(equipMockGear("装备.符纹刀")).toMatchObject({ ok: true });
    const round = readMockCombat().rounds[0];
    expect(round?.consumable_use_count).toBe(1);
    expect(round?.gear_equip_count).toBe(1);
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
    expect(readMockCombat().rounds[0]?.cards_log).toHaveLength(1);
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

    expect(monsterEntity(MONSTER_1).components.some((c) => c.name === COMPONENT.Death)).toBe(true);
    expect(actorEntity(PLAYER).components.some((c) => c.name === COMPONENT.Loot)).toBe(true);
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
