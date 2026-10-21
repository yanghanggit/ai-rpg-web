/**
 * mock 用的内存战斗状态（战斗房间）。
 *
 * 只管战斗状态本身（`Combat` + 各参战者的战斗组件 + 战利品）；参战者在哪个场景由 `./dungeons`
 * 经 `./stages` 处理。`state` 取值与后端 `models/combat.py::CombatState` 一致。
 */
import type { Schemas } from "../api/types";
import { COMPONENT } from "../features/entities/componentNames";
import type { Entity, EntityData } from "../features/entities/ecs";
import {
  blueprintFixture,
  deckFixtures,
  defaultDeckFixture,
  defaultMonsterDeckFixture,
  dungeonFixture,
  monsterDeckFixtures,
  roundFixture,
} from "./fixtures";
import { addMockInventoryItems, takeMockInventoryConsumable } from "./items";
import { readMockPartyNames } from "./opening";

type RawCard = Record<string, unknown>;

const STATE_NONE = 0;
const STATE_INITIALIZATION = 1;
const STATE_ONGOING = 2;
const STATE_POST_COMBAT = 4;
const RESULT_WIN = 1;
const RESULT_LOSE = 2;

/** 每回合起始能量（真实后端由 `CharacterStats` 初始化，mock 给固定值）。 */
const MOCK_ENERGY = 3;
/** 每回合每人抓牌张数（故意大于 3，方便看手牌横向滚动 / 超过三张的排布）。 */
const MOCK_DRAW_PER_TURN = 5;

/** 单个参战者的战斗组件状态（手牌 / 三个牌堆 / 能量）。 */
interface BattleActor {
  draw: RawCard[];
  hand: RawCard[];
  discard: RawCard[];
  exhaust: RawCard[];
  energy: number;
}

let combat: Schemas["Combat"] = emptyCombat();
let battle = new Map<string, BattleActor>();
let dead = new Set<string>();
let loot: RawCard[] = [];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyCombat(): Schemas["Combat"] {
  return {
    name: "（mock）地窟深处战斗",
    state: STATE_NONE,
    result: 0,
    rounds: [],
    retreated: false,
  };
}

/** 副本里所有战斗房间的怪物名（用于在没有指定房间时构造参战者）。 */
function fixtureMonsterNames(): string[] {
  const names: string[] = [];
  for (const room of dungeonFixture.rooms) {
    if (room.type !== "combat") {
      continue;
    }
    for (const actor of room.stage.actors) {
      if (actor.type === "Monster") {
        names.push(actor.name);
      }
    }
  }
  return names;
}

/** 某个怪物在副本蓝图里的定义（拿它的属性）；不是怪物返回 `undefined`。 */
function monsterActor(name: string): Schemas["Actor"] | undefined {
  for (const room of dungeonFixture.rooms) {
    if (room.type !== "combat") {
      continue;
    }
    const actor = room.stage.actors.find((entry) => entry.name === name);
    if (actor !== undefined) {
      return actor;
    }
  }
  return undefined;
}

function newBattleActor(name: string): BattleActor {
  const isMonster = monsterActor(name) !== undefined;
  return {
    // 队伍用固定牌组，怪物用其 `DeckComponent` 里的牌。**怪物也抓牌**（后端
    // `DrawCardsActionSystem` 给所有存活角色填 `HandComponent`）：只是它们不出牌，由
    // `MonsterPrePlaySystem` 自动决策。手牌里的「受击词缀」是对手可见的信息（见 `cmd_hand`）。
    draw: clone(
      isMonster
        ? (monsterDeckFixtures[name] ?? defaultMonsterDeckFixture)
        : (deckFixtures[name] ?? defaultDeckFixture),
    ),
    hand: [],
    discard: [],
    exhaust: [],
    energy: 0,
  };
}

/** 当前参战者顺序（队伍与怪物**交错**：我 / 敌 / 我 / 敌…）；由最近一次 `resetMockCombat` 决定。 */
export function readMockCombatParticipants(): string[] {
  return [...battle.keys()];
}

/** 当前战斗数据快照（深拷贝）。 */
/** 服务端 `combat.is_post_combat` 的 mock 版（退出 / 推进的前置之一）。 */
export function isMockPostCombat(): boolean {
  return combat.state === STATE_POST_COMBAT;
}

export function readMockCombat(): Schemas["Combat"] {
  return clone(combat);
}

/** 当前战利品（供测试断言）。 */
export function readMockCombatLoot(): RawCard[] {
  return clone(loot);
}

/** 某个参战者当前手牌（供测试 / dev 种子断言；正式读手牌走实体组件）。 */
export function readMockHand(name: string): RawCard[] {
  const actor = battle.get(name);
  return actor === undefined ? [] : clone(actor.hand);
}

/**
 * dev 种子专用：直接把某个角色的**抽牌堆**换成给定牌（必须在 `drawMockCards` 之前调用）。
 *
 * 只服务 `?seed=combat:turn`——把一把兼顾多段 / 目标类型 / 词缀的牌摆进手牌，让一个出牌页就能把卡面看全。
 * 正常流程与测试都走 `deckFixtures`，不经过这里（所以既有牌组断言不受影响）。
 */
export function setMockDrawPile(name: string, cards: RawCard[]): void {
  const actor = battle.get(name);
  if (actor !== undefined) {
    actor.draw = clone(cards);
  }
}

/**
 * 把队伍与怪物交错排：我 / 敌 / 我 / 敌…（人数不等时多的一方接在后面）。
 *
 * 让 mock 的行动顺序不再是「我方整块、敌方整块」，这样名单（`.combat-action-roster`）
 * 上能看到队伍与怪物真正的穿插——贴近真实回合制里双方交替出手的样子。
 */
function interleaveParties(party: readonly string[], monsters: readonly string[]): string[] {
  const order: string[] = [];
  const length = Math.max(party.length, monsters.length);
  for (let index = 0; index < length; index += 1) {
    const member = party[index];
    if (member !== undefined) {
      order.push(member);
    }
    const monster = monsters[index];
    if (monster !== undefined) {
      order.push(monster);
    }
  }
  return order;
}

/**
 * 复位为「刚进入战斗房间」：`state = INITIALIZATION`、清空回合与战斗组件，按 `monsterNames`
 * 建立参战者（队伍从 `./opening` 取）。
 *
 * 队伍与怪物**交错**入座（`interleaveParties`），所以 `readMockCombatParticipants` 与 `action_order`
 * 都是「我 / 敌 / 我 / 敌…」。进入 / 推进到战斗房间时由 `./dungeons` 调用。
 */
export function resetMockCombat(monsterNames: readonly string[] = fixtureMonsterNames()): void {
  combat = emptyCombat();
  combat.state = STATE_INITIALIZATION;
  battle = new Map();
  dead = new Set();
  loot = [];
  for (const name of interleaveParties(readMockPartyNames(), monsterNames)) {
    battle.set(name, newBattleActor(name));
  }
}

/** 战斗初始化：INITIALIZATION → ONGOING，并清空回合（对应后端战斗初始化任务）。 */
export function initMockCombat(): { ok: boolean; message: string } {
  if (combat.state !== STATE_INITIALIZATION && combat.state !== STATE_NONE) {
    return { ok: false, message: "战斗未处于开始阶段" };
  }
  combat.state = STATE_ONGOING;
  combat.rounds = [];
  return { ok: true, message: "战斗初始化完成" };
}

function latestRound(): Schemas["Round"] | undefined {
  return combat.rounds.at(-1);
}

/** 校验「当前有可行动的角色」这一共用前置条件；失败给出原因。 */
function validateTurn():
  | { ok: true; round: Schemas["Round"]; actor: string }
  | { ok: false; message: string } {
  if (combat.state !== STATE_ONGOING) {
    return { ok: false, message: "当前战斗未在 ONGOING 状态，无法行动" };
  }
  const round = latestRound();
  if (round === undefined) {
    return { ok: false, message: "当前没有进行中的回合" };
  }
  if (round.is_completed) {
    return { ok: false, message: "本回合已完成" };
  }
  if (!round.draw_completed) {
    return { ok: false, message: "本回合尚未抓牌" };
  }
  if (round.current_actor === null || round.current_actor === undefined) {
    return { ok: false, message: "当前没有行动角色" };
  }
  return { ok: true, round, actor: round.current_actor };
}

/** 抓牌：开新回合 + 填手牌（对应后端 `draw_cards`）。 */
export function drawMockCards(): { ok: boolean; message: string } {
  if (combat.state !== STATE_ONGOING) {
    return { ok: false, message: "当前战斗未在 ONGOING 状态，无法抓牌" };
  }
  const previous = latestRound();
  if (previous !== undefined && !previous.is_completed && previous.draw_completed) {
    return { ok: false, message: "本回合已抽牌，无法重复抽牌" };
  }

  const order = readMockCombatParticipants();
  combat.rounds.push(
    roundFixture({
      action_order: [...order],
      current_actor: order[0] ?? null,
      draw_completed: true,
    }),
  );

  for (const name of order) {
    const actor = battle.get(name);
    if (actor === undefined) {
      continue;
    }
    // 回合结束时手牌进弃牌堆（对齐后端），再抓 `MOCK_DRAW_PER_TURN` 张
    actor.discard.push(...actor.hand);
    actor.hand = [];
    for (let i = 0; i < MOCK_DRAW_PER_TURN; i += 1) {
      // 抽牌堆空了就把弃牌堆洗回来（后端 `_draw_from_pile` 同一条规则；mock 不追求随机，
      // 直接按弃牌堆原序回填，测试才好断言）
      if (actor.draw.length === 0) {
        if (actor.discard.length === 0) {
          break;
        }
        actor.draw = actor.discard;
        actor.discard = [];
      }
      const card = actor.draw.shift();
      if (card !== undefined) {
        actor.hand.push(card);
      }
    }
    actor.energy = MOCK_ENERGY;
  }

  return { ok: true, message: `已开新回合并抓牌完成（第 ${combat.rounds.length} 回合）` };
}

/** 把当前行动角色记入 `completed_actors` 并推进到下一个；全员过完则标记回合完成。 */
function advanceTurn(round: Schemas["Round"]): string | null {
  const actor = round.current_actor;
  if (actor !== null && actor !== undefined) {
    round.completed_actors.push(actor);
  }
  const completed = new Set(round.completed_actors);
  const next = round.action_order.find((name) => !completed.has(name)) ?? null;
  round.current_actor = next;
  if (next === null) {
    round.is_completed = true;
  }
  return next;
}

/** 卡牌费用；mock 手里的原始载荷是 `Record<string, unknown>`，缺失按 0（与 `readCard` 同一兜底）。 */
function readCardCost(card: RawCard): number {
  return typeof card.cost === "number" ? card.cost : 0;
}

/**
 * 出牌：扣能量、从手牌移出并记日志 / 叙事（不推进行动权），对应后端 `play_cards`（我方）。
 *
 * **能量是要扣的**：后端 `play_cards_action_system` 每张牌 `consume_energy(card.cost)`，且能量不够
 * 时是硬错误（怪物 AI 也拿 `card.cost <= energy` 筛过一遍）。mock 不扣的话，
 * 「费用 > 剩余能量」这个状态就永远走不到——现在它既拦（与后端同一口径），也会真扣。
 */
export function playMockCards(
  actorName: string,
  cardName: string,
  targets: readonly string[],
): { ok: boolean; message: string } {
  const check = validateTurn();
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  const actor = battle.get(actorName);
  const index = actor === undefined ? -1 : actor.hand.findIndex((card) => card.name === cardName);
  if (actor === undefined || index === -1) {
    return { ok: false, message: `手牌中找不到『${cardName}』` };
  }

  const chosen = actor.hand[index];
  const cost = chosen === undefined ? 0 : readCardCost(chosen);
  if (cost > actor.energy) {
    return {
      ok: false,
      message: `能量不足：『${cardName}』需 ${cost} 点，现有 ${actor.energy} 点`,
    };
  }

  const [card] = actor.hand.splice(index, 1);
  if (card !== undefined) {
    actor.energy -= cost;
    if (card.exhaust === true) {
      actor.exhaust.push(card);
    } else {
      actor.discard.push(card);
    }
  }

  const targetLabel = targets.length > 0 ? targets.join("、") : "（自动目标）";
  check.round.entries.push({
    kind: "cards",
    log: `${actorName} 使用『${cardName}』对 ${targetLabel} 造成伤害。`,
    narrative: `${actorName} 打出『${cardName}』，命中目标！`,
  });
  return { ok: true, message: "出牌完成" };
}

/**
 * 使用消耗品：先扣整条库存（消耗其全部 count），再把「每个内置牌 × count」物化进当前行动者手牌。
 * 不推进行动权，效果结算交给之后的出牌（对应后端 `UseConsumableItemActionSystem`）。
 */
export function useMockConsumable(itemName: string): { ok: boolean; message: string } {
  const check = validateTurn();
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  const actor = battle.get(check.actor);
  if (actor === undefined) {
    return { ok: false, message: `找不到当前行动角色 ${check.actor}` };
  }

  const removed = takeMockInventoryConsumable(itemName);
  if (removed === null) {
    return { ok: false, message: `背包中找不到消耗品『${itemName}』` };
  }

  const specs = Array.isArray(removed.cards) ? (removed.cards as RawCard[]) : [];
  const count = typeof removed.count === "number" ? removed.count : 1;
  const materialized: RawCard[] = [];
  for (const spec of specs) {
    for (let i = 0; i < count; i += 1) {
      const card = clone(spec);
      card.uuid = `mock-consumable-${String(removed.uuid)}-${materialized.length}`;
      card.source = check.actor;
      card.exhaust = true;
      card.retain = true;
      materialized.push(card);
    }
  }
  actor.hand.push(...materialized);

  const cardNames = materialized.map((card) => String(card.name)).join("、");
  check.round.entries.push({
    kind: "consumable",
    log: `[${check.actor} 使用 ${itemName} ×${count}] 生成手牌「${cardNames}」`,
    narrative: "（mock）消耗品已物化为手牌，待出牌结算。",
  });
  return { ok: true, message: "使用完成" };
}

/** 使用装备：记日志 / 叙事并累加次数（不推进行动权）。 */
export function equipMockGear(itemName: string): { ok: boolean; message: string } {
  const check = validateTurn();
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  check.round.entries.push({
    kind: "gear",
    log: `将『${itemName}』转化为手牌。`,
    narrative: `装备『${itemName}』已就绪。`,
  });
  return { ok: true, message: "使用完成" };
}

/** 过牌：结束当前角色回合（我方）。 */
export function passMockTurn(): { ok: boolean; message: string } {
  const check = validateTurn();
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  const actor = check.actor;
  const next = advanceTurn(check.round);
  return {
    ok: true,
    message:
      next === null
        ? `${actor} 过牌完成；所有角色均已行动，本回合结束`
        : `${actor} 过牌完成；轮到下一个角色：${next}`,
  };
}

/** 推进怪物回合：自动出牌一次并结束回合（对应后端 `play_cards` 的怪物分支）。 */
export function advanceMockMonsterTurn(): { ok: boolean; message: string } {
  const check = validateTurn();
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  const actor = check.actor;
  check.round.entries.push({
    kind: "cards",
    log: `${actor} 自动出牌，造成若干伤害。`,
    narrative: `${actor} 发起了攻击！`,
  });
  const next = advanceTurn(check.round);
  return {
    ok: true,
    message:
      next === null
        ? `${actor} 回合推进完成；本回合结束`
        : `${actor} 回合推进完成；轮到下一个角色：${next}`,
  };
}

/**
 * 把当前回合直接推到「全员已行动」：dev 种子专用（看回合之间那一屏）。
 *
 * 与真流程同一条推进（`passMockTurn` / `advanceMockMonsterTurn`），只是替玩家把剩下的过牌点完。
 */
export function completeMockRound(): boolean {
  for (let guard = 0; guard < 32; guard += 1) {
    const round = latestRound();
    if (round === undefined) {
      return false;
    }
    if (round.is_completed) {
      return true;
    }
    const actor = round.current_actor;
    if (actor === null || actor === undefined) {
      return false;
    }
    const result = monsterActor(actor) === undefined ? passMockTurn() : advanceMockMonsterTurn();
    if (!result.ok) {
      return false;
    }
  }
  return false;
}

/** 撤退：战斗以失败结束（对应后端 `retreat`）。 */
export function retreatMockCombat(): { ok: boolean; message: string } {
  if (combat.state !== STATE_ONGOING) {
    return { ok: false, message: "只能在战斗进行中撤退" };
  }
  combat.result = RESULT_LOSE;
  combat.retreated = true;
  combat.state = STATE_POST_COMBAT;
  return { ok: true, message: "撤退完成" };
}

/** 收取战利品（转入背包并清空 `LootComponent`）。 */
export function collectMockLoot(): { ok: boolean; message: string } {
  if (loot.length === 0) {
    return { ok: false, message: "当前没有可收取的战利品" };
  }
  const count = loot.length;
  addMockInventoryItems(loot);
  loot = [];
  return { ok: true, message: `已收取 ${count} 件战利品到背包` };
}

/** 开发调试 / 测试用：直接预置结算态（一局已完成回合 + 胜利 + 战利品 + 怪物已战死）。 */
export function prepareMockPostCombat(): void {
  combat.state = STATE_POST_COMBAT;
  combat.result = RESULT_WIN;
  const order = readMockCombatParticipants();
  combat.rounds = [
    roundFixture({
      completed_actors: [...order],
      action_order: [...order],
      draw_completed: true,
      is_completed: true,
      entries: [
        {
          kind: "cards",
          log: `${order[0] ?? "角色"} 使用『刺击』造成致命一击。`,
          narrative: `${order[0] ?? "角色"} 打出『刺击』，一击命中！`,
        },
      ],
    }),
  ];
  for (const name of order) {
    if (monsterActor(name) !== undefined) {
      dead.add(name);
    }
  }
  loot = [
    {
      name: "材料.腐化兽骨",
      uuid: "mock-loot-bone",
      type: "MaterialItem",
      description: "（mock）从腐沼巨蜥残骸里剥离的兽骨。",
      count: 2,
    },
  ];
}

/**
 * 开发调试 / 测试用：直接预置**战败**结算态。
 *
 * 判据同服务端 `_is_player_side_eliminated`（我方全员 `DeathComponent`）：队伍成员逐个战死、怪物
 * 存活，`result = LOSE`、`state = POST_COMBAT`；战败不掉战利品，所以 `loot` 清空。
 * 撤退另有 `retreatMockCombat` 覆盖。
 */
export function prepareMockDefeat(): void {
  combat.state = STATE_POST_COMBAT;
  combat.result = RESULT_LOSE;
  const order = readMockCombatParticipants();
  const monsters = order.filter((name) => monsterActor(name) !== undefined);
  const lastBlow = monsters.at(-1) ?? "怪物";
  combat.rounds = [
    roundFixture({
      completed_actors: [...order],
      action_order: [...order],
      draw_completed: true,
      is_completed: true,
      entries: [
        {
          kind: "cards",
          log: `${lastBlow} 的最后一击命中了队伍，全员倒下。`,
          narrative: `${lastBlow} 嘶吼着扑来，队伍再无人起身。`,
        },
      ],
    }),
  ];
  for (const name of order) {
    if (monsterActor(name) === undefined) {
      dead.add(name);
    }
  }
  loot = [];
}

/**
 * 怪物基础实体（怪物不是家园 NPC，`./items` 查不到，所以在这里构造）。
 *
 * 组件与队伍成员同底：`IdentityComponent` / `AppearanceComponent` / `CharacterStatsComponent`
 * 与 `DeckComponent`（战斗双方都持牌库），只把类型标记换成 `MonsterComponent`（真实后端
 * `dbg_game.py` 给所有 actor 都挂外观组件，`appearance` 初始 = `base_body`；怪物不穿时装，所以
 * 两者相同）。
 */
export function readMockCombatActorEntity(name: string): Entity | null {
  const actor = monsterActor(name);
  if (actor === undefined) {
    return null;
  }
  return {
    name,
    data: {
      [COMPONENT.Monster]: { name },
      [COMPONENT.Identity]: { name, creation_order: 0, entity_id: `mock-${name}` },
      [COMPONENT.Appearance]: { name, base_body: actor.base_body, appearance: actor.base_body },
      [COMPONENT.CharacterStats]: { name, stats: clone(actor.character_stats) },
      [COMPONENT.Deck]: {
        name,
        cards: clone(monsterDeckFixtures[name] ?? defaultMonsterDeckFixture),
      },
    },
  };
}

/**
 * 给参战实体补上战斗组件（`RoundStats` / 手牌 / 三个牌堆 / 死亡 / 战利品）。
 *
 * 不在本场战斗里的实体原样返回。手牌与牌堆只在**本回合已抓牌**后才存在，
 * `RoundStatsComponent` 只在有回合时存在——与真实 ECS 一致。
 */
export function withMockCombatComponents(entity: Entity): Entity {
  if (!battle.has(entity.name)) {
    return entity;
  }
  const data: EntityData = { ...entity.data };
  const actor = battle.get(entity.name);
  const round = latestRound();

  if (round?.draw_completed && actor !== undefined) {
    data[COMPONENT.RoundStats] = { name: entity.name, energy: actor.energy };
    data[COMPONENT.Hand] = { name: entity.name, cards: clone(actor.hand) };
    data[COMPONENT.DrawPile] = { name: entity.name, cards: clone(actor.draw) };
    data[COMPONENT.DiscardPile] = { name: entity.name, cards: clone(actor.discard) };
    data[COMPONENT.ExhaustPile] = { name: entity.name, cards: clone(actor.exhaust) };
  }
  if (dead.has(entity.name)) {
    data[COMPONENT.Death] = { name: entity.name };
  }
  if (entity.name === blueprintFixture.player_actor && loot.length > 0) {
    data[COMPONENT.Loot] = { name: entity.name, items: clone(loot) };
  }
  return { name: entity.name, data };
}

/** 复位成「没有战斗」（测试之间隔离）。 */
export function resetMockCombatState(): void {
  combat = emptyCombat();
  battle = new Map();
  dead = new Set();
  loot = [];
}
