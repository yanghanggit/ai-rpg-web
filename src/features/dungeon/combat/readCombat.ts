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
  if (hasComponent(entity, "PlayerComponent") || hasComponent(entity, "NPCComponent")) {
    return "party";
  }
  if (hasComponent(entity, "MonsterComponent")) {
    return "monster";
  }
  return "unknown";
}

/** `DeathComponent` 只有有无之分（后端把死亡当标记）。 */
export function isDead(entity: Entity): boolean {
  return hasComponent(entity, "DeathComponent");
}

export function isPlayer(entity: Entity): boolean {
  return hasComponent(entity, "PlayerComponent");
}

/** 本回合能量（`RoundStatsComponent.energy`）；没有该组件（未抓牌 / 非战斗单位）时为 0。 */
export function readEnergy(entity: Entity): number {
  return readNumber(getComponentData(entity, "RoundStatsComponent"), "energy") ?? 0;
}

/** 手牌（`HandComponent.cards`）；未抓牌时为空数组。 */
export function readHand(entity: Entity): Card[] {
  return readCards(entity.components, "HandComponent");
}

/** 手牌提供的总格挡，与后端 `compute_hand_block` 一致。 */
export function computeHandBlock(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.block, 0);
}

function countCards(entity: Entity, componentName: string): number {
  const data = getComponentData(entity, componentName);
  if (data === undefined || !Array.isArray(data.cards)) {
    return 0;
  }
  return data.cards.length;
}

/** 三个牌堆的张数；未抓牌时都为 0。 */
export function readPiles(entity: Entity): CombatPiles {
  return {
    draw: countCards(entity, "DrawPileComponent"),
    discard: countCards(entity, "DiscardPileComponent"),
    exhaust: countCards(entity, "ExhaustPileComponent"),
  };
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
