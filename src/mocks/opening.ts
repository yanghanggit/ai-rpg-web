/**
 * mock 用的内存「本次副本开局」状态：队伍快照、牌组、卡池、开场是否已初始化。
 *
 * 真实后端里这些都不是独立的数据结构，而是**实体上的组件**：
 * - 队伍：`enter_dungeon` 时给玩家与名单成员挂 `PartyMemberComponent`（此后名单不可改）；
 * - 牌组：各成员的 `DeckComponent`；卡池：`SpoilsComponent`（生成后才有，挑一张即整个清掉）；
 * - 开场是否初始化：`OpeningRoom.initialized`（属于副本房间，所以 `/room` 的响应要带上它）。
 *
 * mock 里按同一语义维护这几份状态，让 `pnpm dev:mock` 下「初始化 → 生成卡池 → 挑卡 →
 * 进入下一关」整条链路可走。组件的**拼装**在这里，副本本身的状态在 `./dungeons`，
 * 两者由 handler 接线（真实后端也是 API 层把两边读出来拼成响应）。
 */
import type { Schemas } from "../api/types";
import { cardPoolFixture, deckFixtures, defaultDeckFixture } from "./fixtures";
import { readMockActorEntity } from "./items";

type RawCard = Record<string, unknown>;

/** 进副本时固化的队伍（含玩家，顺序同名单）。 */
let party: string[] = [];
/** 各成员的牌组。 */
let decks = new Map<string, RawCard[]>();
/** 各成员的卡池；没有条目表示尚未生成。 */
let pools = new Map<string, RawCard[]>();
/** 开场是否已初始化（叙事 + 牌库）。 */
let initialized = false;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** 队伍成员名（含玩家）。 */
export function readMockPartyNames(): string[] {
  return [...party];
}

export function readMockOpeningInitialized(): boolean {
  return initialized;
}

/**
 * 进副本：固化队伍并给每人装上初始牌组（卡池清空、开场回到未初始化）。
 *
 * @param members 队伍成员（含玩家，顺序同名单）。
 */
export function enterMockOpeningParty(members: readonly string[]): void {
  party = [...members];
  decks = new Map(members.map((name) => [name, clone(deckFixtures[name] ?? defaultDeckFixture)]));
  pools = new Map();
  initialized = false;
}

/** 退出副本：副本结束，这一局的开场状态一并清掉。 */
export function leaveMockOpening(): void {
  party = [];
  decks = new Map();
  pools = new Map();
  initialized = false;
}

/**
 * 给角色实体补上「本次副本」的组件（`PartyMemberComponent` / `DeckComponent` / `SpoilsComponent`）。
 *
 * 不在队伍里的角色原样返回——组件是进副本时才挂上去的。
 */
export function withMockOpeningComponents(
  entity: Schemas["EntitySerialization"],
): Schemas["EntitySerialization"] {
  if (!party.includes(entity.name)) {
    return entity;
  }
  const components = [...entity.components];
  components.push({ name: "PartyMemberComponent", data: { name: entity.name } });
  components.push({
    name: "DeckComponent",
    data: { name: entity.name, cards: clone(decks.get(entity.name) ?? []) },
  });
  const pool = pools.get(entity.name);
  if (pool !== undefined) {
    components.push({ name: "SpoilsComponent", data: { name: entity.name, cards: clone(pool) } });
  }
  return { name: entity.name, components };
}

/** 队伍成员实体（`group?all_of=PartyMemberComponent` 的返回体）。 */
export function readMockPartyEntities(): Schemas["EntitySerialization"][] {
  const entities: Schemas["EntitySerialization"][] = [];
  for (const name of party) {
    const base = readMockActorEntity(name);
    if (base !== null) {
      entities.push(withMockOpeningComponents(base));
    }
  }
  return entities;
}

/** 开场初始化：叙事 + 牌库（mock 里只切状态，叙事由 handler 追一条消息）。 */
export function initMockOpening(): void {
  initialized = true;
}

/** 卡池生成：给每个成员各装一份候选卡（后端 `CARD_POOL_SIZE = 3`）。 */
export function generateMockCardPool(): void {
  pools = new Map(party.map((name) => [name, clone(cardPoolFixture)]));
}

/**
 * 从某人的卡池挑一张卡加入其牌库，并**清空整个卡池**（后端的 3 选 1 语义）。
 *
 * 返回 `{ ok: false, error }` 时与后端一样只说明原因，不改任何状态。
 */
export function pickMockCard(
  actorName: string,
  cardName: string,
): { ok: true } | { ok: false; error: string } {
  if (!party.includes(actorName)) {
    return { ok: false, error: `角色 ${actorName} 不是队伍成员，无法从卡池挑卡` };
  }
  const pool = pools.get(actorName);
  if (pool === undefined) {
    return { ok: false, error: `角色 ${actorName} 尚无卡池（SpoilsComponent），请先生成卡池` };
  }
  const index = pool.findIndex((card) => card.name === cardName);
  const selected = pool[index];
  if (index === -1 || selected === undefined) {
    return { ok: false, error: `角色 ${actorName} 卡池中找不到卡牌 '${cardName}'` };
  }
  decks.set(actorName, [...(decks.get(actorName) ?? []), clone(selected)]);
  pools.delete(actorName);
  return { ok: true };
}

/** 复位成「没有副本在跑」（测试之间隔离）。 */
export function resetMockOpening(): void {
  leaveMockOpening();
}
