/**
 * 战斗房间的战斗单位读取（纯函数，无 React / 网络）。
 *
 * 战场状态不是一条接口直接给出来的：`Round` 只记「发生了什么」（日志 / 叙事 / 行动顺序），
 * 血量、能量、手牌、格挡、牌堆都挂在**实体组件**上（队伍从 `PartyMemberComponent` 取、
 * 怪物从房间场景取，再 `entities/v1/.../details` 取组件）。
 *
 * 组件的存在性 / 字段读取 / 属性解析统一走 `features/entities/ecs`；这里只保留
 * 「战斗界面要看哪些字段」的领域选择（阵营 / 手牌 / 牌堆 / 格挡）与展示口径，对齐 TUI：
 * - 阵营 `classify_faction`（`cmd_combat.py`）：玩家 / NPC → 我方，怪物 → 敌方；
 * - 总格挡 `compute_hand_block`（`models/utils.py`）：手牌 `block` 求和；
 * - 牌堆只数张数（抽牌 / 弃牌 / 消耗），与 `/hand` 命令一致。
 */
import type { Schemas } from "../../../api/types";
import { readCards } from "../../cards/readCards";
import type { Card } from "../../cards/types";
import { COMPONENT, type ComponentName } from "../../entities/componentNames";
import { getComponentData, hasComponent, readCharacterStats, readNumber } from "../../entities/ecs";

type Entity = Schemas["EntitySerialization"];

/** 战斗阵营：我方（玩家 + 队友）/ 敌方（怪物）/ 未知。 */
export type Faction = "party" | "monster" | "unknown";

/** 三个牌堆的张数。 */
export interface CombatPiles {
  draw: number;
  discard: number;
  exhaust: number;
}

/** 单个参战角色在战斗界面里需要的全部字段。 */
export interface Combatant {
  name: string;
  faction: Faction;
  /** 玩家本人（`PlayerComponent`）；`faction === "party" && !player` 即队友。 */
  player: boolean;
  /** 是否已战死（`DeathComponent` 只判存在性）。 */
  dead: boolean;
  stats: Schemas["CharacterStats"] | null;
  /** 本回合能量（`RoundStatsComponent.energy`）。 */
  energy: number;
  hand: Card[];
  /** 手牌提供的总格挡。 */
  block: number;
  piles: CombatPiles;
}

/** 阵营判据与 TUI `classify_faction` 一致：玩家 / NPC → 我方，怪物 → 敌方。 */
export function classifyFaction(entity: Entity): Faction {
  if (hasComponent(entity, COMPONENT.Player) || hasComponent(entity, COMPONENT.NPC)) {
    return "party";
  }
  if (hasComponent(entity, COMPONENT.Monster)) {
    return "monster";
  }
  return "unknown";
}

/** `DeathComponent` 只有有无之分（后端把死亡当标记）。 */
export function isDead(entity: Entity): boolean {
  return hasComponent(entity, COMPONENT.Death);
}

export function isPlayer(entity: Entity): boolean {
  return hasComponent(entity, COMPONENT.Player);
}

/** 本回合能量（`RoundStatsComponent.energy`）；没有该组件（未抓牌 / 非战斗单位）时为 0。 */
export function readEnergy(entity: Entity): number {
  return readNumber(getComponentData(entity, COMPONENT.RoundStats), "energy") ?? 0;
}

/** 手牌（`HandComponent.cards`）；未抓牌时为空数组。 */
export function readHand(entity: Entity): Card[] {
  return readCards(entity.components, COMPONENT.Hand);
}

/** 手牌提供的总格挡，与后端 `compute_hand_block` 一致。 */
export function computeHandBlock(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.block, 0);
}

/** 手牌里「被命中时」（`on_hit_affixes`）词缀的条数。 */
export function countOnHitAffixes(combatant: Combatant): number {
  return combatant.hand.reduce((total, card) => total + card.on_hit_affixes.length, 0);
}

/**
 * 一张牌是不是「**我方塞到敌方手里**」的：持牌者是敌方（怪物），而 `source` 是我方成员。
 *
 * 我方成员自己手里的牌（哪怕 `source` 也是我方）**不算**——那是本家牌，不是
 * "塞牌"（界面标 [塞牌]）。这是给当前决策者看的一个信号：对手手里有没有、有几张是我方塞过去的。
 */
export function isTransferredCard(card: Card, owner: Combatant, combatants: Combatant[]): boolean {
  if (owner.faction !== "monster") {
    return false;
  }
  return combatants.some((other) => other.name === card.source && other.faction === "party");
}

/** 手牌里来自我方阵营的牌数（即"我方塞过去的"，界面标 [塞牌]）。 */
export function countTransferredCards(combatant: Combatant, combatants: Combatant[]): number {
  return combatant.hand.filter((card) => isTransferredCard(card, combatant, combatants)).length;
}

/**
 * 选中的这张牌、在名单里该被"压下"（选中）的目标（原始名）。
 *
 * - `self_target` → 出牌者自己；
 * - `single` → 玩家点中的那一个锚点；
 * - `all`（阵营全体）/ `spread`（阵营散射）→ **锚点所在阵营的全体存活者**。
 *
 * `all` / `spread` 的“阵营”与服务端 `resolve_targets` 里 `_expand_camp_members` 同一口径
 * （取锚点的 `PartyMemberComponent` / `MonsterComponent`）：所以客户端能**提前把整个阵营算出来**，
 * 直接给整阵营挂上选中态；发请求时仍只发那一个锚点（服务端要求恰好一个锚点）。
 * `spread` 与 `all` 的差别只在结算（命中在阵营内随机）与文案，不在选中集合。
 */
export function readTargetNames(
  card: Card,
  anchor: string | null,
  actor: string,
  combatants: Combatant[],
): string[] {
  if (card.self_target) {
    return [actor];
  }
  if (anchor === null) {
    return [];
  }
  if (card.target_type === "single") {
    return [anchor];
  }
  const anchorCombatant = combatants.find((combatant) => combatant.name === anchor);
  if (anchorCombatant === undefined) {
    return [anchor];
  }
  return combatants
    .filter((combatant) => !combatant.dead && combatant.faction === anchorCombatant.faction)
    .map((combatant) => combatant.name);
}

function countCards(entity: Entity, componentName: ComponentName): number {
  const data = getComponentData(entity, componentName);
  if (data === undefined || !Array.isArray(data.cards)) {
    return 0;
  }
  return data.cards.length;
}

/** 三个牌堆的张数；未抓牌时都为 0。 */
export function readPiles(entity: Entity): CombatPiles {
  return {
    draw: countCards(entity, COMPONENT.DrawPile),
    discard: countCards(entity, COMPONENT.DiscardPile),
    exhaust: countCards(entity, COMPONENT.ExhaustPile),
  };
}

/** 阵营 / 身份 → 界面标签，与 TUI `role_label` 一致（玩家 / 队友 / 怪物）。 */
export function roleLabel(combatant: Combatant): string {
  if (combatant.faction === "monster") {
    return "怪物";
  }
  if (combatant.player) {
    return "玩家";
  }
  if (combatant.faction === "party") {
    return "队友";
  }
  return "？";
}

/** 把单个参战角色的界面字段一次读全。 */
export function readCombatant(entity: Entity): Combatant {
  const hand = readHand(entity);
  return {
    name: entity.name,
    faction: classifyFaction(entity),
    player: isPlayer(entity),
    dead: isDead(entity),
    stats: readCharacterStats(entity),
    energy: readEnergy(entity),
    hand,
    block: computeHandBlock(hand),
    piles: readPiles(entity),
  };
}
