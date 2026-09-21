/**
 * mock 用的内存战斗状态（战斗房间）。
 *
 * 对应 TUI 的 `tui/mock_data.py`：真实后端把战斗状态记在 `Combat`（state / result / rounds）
 * 上，把血量 / 能量 / 手牌 / 牌堆 / 战利品挂在**实体组件**上；mock 在这里按同一语义维护
 * 这几份状态，让 `pnpm dev:mock` 下「初始化 → 抓牌 → 出手 → 结算」整条战斗循环可走。
 *
 * 分工与其它 mock 模块一致：
 * - 本模块只管**战斗状态本身**（`Combat` + 各参战者的战斗组件 + 战利品）；
 * - 参战者是否被搬到哪个场景，由 `./dungeons` 通过 `./stages` 处理；
 * - 组件的拼装（`withMockCombatComponents` / `readMockCombatActorEntity`）在这里，
 *   副本本身的状态在 `./dungeons`，由 handler 接线（真实后端也是 API 层把两边读出来拼响应）。
 *
 * 状态取值与后端 `models/combat.py::CombatState` 一致：
 * `0 NONE / 1 INITIALIZATION / 2 ONGOING / 3 COMPLETE / 4 POST_COMBAT`。
 */
import type { Schemas } from "../api/types";
import {
  blueprintFixture,
  deckFixtures,
  defaultDeckFixture,
  dungeonFixture,
  roundFixture,
} from "./fixtures";
import { readMockPartyNames } from "./opening";

type RawCard = Record<string, unknown>;
type Entity = Schemas["EntitySerialization"];

const STATE_NONE = 0;
const STATE_INITIALIZATION = 1;
const STATE_ONGOING = 2;
const STATE_POST_COMBAT = 4;
const RESULT_WIN = 1;
const RESULT_LOSE = 2;

/** 每回合起始能量（真实后端由 `CharacterStats` 初始化，mock 给固定值）。 */
const MOCK_ENERGY = 3;
/** 每回合每人抓牌张数。 */
const MOCK_DRAW_PER_TURN = 3;

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
  return { name: "（mock）停柩房战斗", state: STATE_NONE, result: 0, rounds: [], retreated: false };
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
    // 怪物不出牌（由 MonsterPrePlay 自动决策），所以不备牌堆；队伍成员用其固定牌组。
    draw: isMonster ? [] : clone(deckFixtures[name] ?? defaultDeckFixture),
    hand: [],
    discard: [],
    exhaust: [],
    energy: 0,
  };
}

/** 当前参战者顺序（队伍在前、怪物在后）；由最近一次 `resetMockCombat` 决定。 */
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

/**
 * 复位为「刚进入战斗房间」：state = INITIALIZATION、清空回合与战斗组件，并按
 * `monsterNames` 建立参战者（队伍从 `./opening` 取）。
 *
 * 进入 / 推进到战斗房间时由 `./dungeons` 调用；与后端 `dungeon_advance_action.py`
 * 把 `combat.state` 置为 `INITIALIZATION` 对齐。
 */
export function resetMockCombat(monsterNames: readonly string[] = fixtureMonsterNames()): void {
  combat = emptyCombat();
  combat.state = STATE_INITIALIZATION;
  battle = new Map();
  dead = new Set();
  loot = [];
  for (const name of [...readMockPartyNames(), ...monsterNames]) {
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
    actor.hand = [];
    for (let i = 0; i < MOCK_DRAW_PER_TURN; i += 1) {
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

/** 出牌：从手牌移出并记日志 / 叙事（不推进行动权），对应后端 `play_cards`（我方）。 */
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

  const [card] = actor.hand.splice(index, 1);
  if (card !== undefined) {
    if (card.exhaust === true) {
      actor.exhaust.push(card);
    } else {
      actor.discard.push(card);
    }
  }

  const targetLabel = targets.length > 0 ? targets.join("、") : "（自动目标）";
  check.round.cards_log.push(`${actorName} 使用『${cardName}』对 ${targetLabel} 造成伤害。`);
  check.round.cards_narrative.push(`${actorName} 打出『${cardName}』，命中目标！`);
  return { ok: true, message: "出牌完成" };
}

/** 使用消耗品：记日志 / 叙事并累加次数（不推进行动权）。 */
export function useMockConsumable(
  itemName: string,
  targets: readonly string[],
): { ok: boolean; message: string } {
  const check = validateTurn();
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  const targetLabel = targets.length > 0 ? targets.join("、") : "（自动目标）";
  check.round.consumable_log.push(`使用『${itemName}』对 ${targetLabel} 生效。`);
  check.round.consumable_narrative.push(`一股暖流涌入体内，『${itemName}』的效力发挥了作用。`);
  check.round.consumable_use_count += 1;
  return { ok: true, message: "使用完成" };
}

/** 使用装备：记日志 / 叙事并累加次数（不推进行动权）。 */
export function equipMockGear(itemName: string): { ok: boolean; message: string } {
  const check = validateTurn();
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  check.round.gear_log.push(`将『${itemName}』转化为手牌。`);
  check.round.gear_narrative.push(`装备『${itemName}』已就绪。`);
  check.round.gear_equip_count += 1;
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
  check.round.cards_log.push(`${actor} 自动出牌，造成若干伤害。`);
  check.round.cards_narrative.push(`${actor} 发起了攻击！`);
  const next = advanceTurn(check.round);
  return {
    ok: true,
    message:
      next === null
        ? `${actor} 回合推进完成；本回合结束`
        : `${actor} 回合推进完成；轮到下一个角色：${next}`,
  };
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
  loot = [];
  return { ok: true, message: `已收取 ${count} 件战利品到背包` };
}

/**
 * 开发调试 / 测试用：直接预置结算态（一局已完成回合 + 胜利 + 战利品 + 怪物已战死），
 * 不必把整场战斗打一遍（对应 TUI 的 `prepare_mock_post_combat`）。
 */
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
      cards_log: [`${order[0] ?? "角色"} 使用『刺击』造成致命一击。`],
      cards_narrative: [`${order[0] ?? "角色"} 打出『刺击』，一击命中！`],
    }),
  ];
  for (const name of order) {
    if (monsterActor(name) !== undefined) {
      dead.add(name);
    }
  }
  loot = [
    {
      name: "素材.腐骨",
      uuid: "mock-loot-bone",
      type: "MaterialItem",
      description: "（mock）从殭尸身上剥下的腐骨。",
      count: 2,
    },
  ];
}

/**
 * 怪物基础实体（怪物不是家园 NPC，`./items` 查不到，所以在这里构造）。
 *
 * 组件与队伍成员同底：`IdentityComponent` / `AppearanceComponent` / `CharacterStatsComponent`，
 * 只把类型标记换成 `MonsterComponent`（真实后端 `dbg_game.py` 给所有 actor 都挂外观组件，
 * `appearance` 初始 = `base_body`；怪物不穿时装，所以两者相同）。
 */
export function readMockCombatActorEntity(name: string): Entity | null {
  const actor = monsterActor(name);
  if (actor === undefined) {
    return null;
  }
  return {
    name,
    components: [
      { name: "MonsterComponent", data: { name } },
      {
        name: "IdentityComponent",
        data: { name, creation_order: 0, entity_id: `mock-${name}` },
      },
      {
        name: "AppearanceComponent",
        data: { name, base_body: actor.base_body, appearance: actor.base_body },
      },
      {
        name: "CharacterStatsComponent",
        data: { name, stats: clone(actor.character_stats) },
      },
    ],
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
  const components = [...entity.components];
  const actor = battle.get(entity.name);
  const round = latestRound();

  if (round?.draw_completed && actor !== undefined) {
    components.push(
      {
        name: "RoundStatsComponent",
        data: { name: entity.name, energy: actor.energy },
      },
      { name: "HandComponent", data: { name: entity.name, cards: clone(actor.hand) } },
      { name: "DrawPileComponent", data: { name: entity.name, cards: clone(actor.draw) } },
      { name: "DiscardPileComponent", data: { name: entity.name, cards: clone(actor.discard) } },
      { name: "ExhaustPileComponent", data: { name: entity.name, cards: clone(actor.exhaust) } },
    );
  }
  if (dead.has(entity.name)) {
    components.push({ name: "DeathComponent", data: { name: entity.name } });
  }
  if (entity.name === blueprintFixture.player_actor && loot.length > 0) {
    components.push({ name: "LootComponent", data: { name: entity.name, items: clone(loot) } });
  }
  return { name: entity.name, components };
}

/** 复位成「没有战斗」（测试之间隔离）。 */
export function resetMockCombatState(): void {
  combat = emptyCombat();
  battle = new Map();
  dead = new Set();
  loot = [];
}
