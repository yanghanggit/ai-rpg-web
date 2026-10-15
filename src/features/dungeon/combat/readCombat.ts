/**
 * 战斗单位读取（纯函数）。
 *
 * `Round` 只记「发生了什么」，血量 / 能量 / 手牌 / 格挡 / 牌堆都挂在实体组件上（队伍走
 * `PartyMemberComponent`、怪物走房间场景）。组件访问走 `features/entities/ecs`，这里只做战斗
 * 界面的领域选择与展示口径：阵营、手牌、牌堆、格挡。
 */
import type { Schemas } from "../../../api/types";
import { readCards } from "../../cards/readCards";
import type { Card } from "../../cards/types";
import { COMPONENT } from "../../entities/componentNames";
import {
  type Entity,
  getComponentData,
  hasComponent,
  readCharacterStats,
  readNumber,
} from "../../entities/ecs";

/** 战斗阵营：我方（玩家 + 队友）/ 敌方（怪物）/ 未知。 */
export type Faction = "party" | "monster" | "unknown";

/** 三个牌堆（键与后端 `DrawPileComponent` / `DiscardPileComponent` / `ExhaustPileComponent` 同名）。 */
export type CombatPileKind = "draw" | "discard" | "exhaust";

/**
 * 三个牌堆里的牌（空堆 = 空数组）。存整张卡而不是张数，张数由 `cards.length` 得出。
 * 顺序照抄服务端：抽牌堆是 FIFO，弃牌 / 消耗堆是追加顺序。
 */
export type CombatPiles = Record<CombatPileKind, Card[]>;

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
  return readCards(entity, COMPONENT.Hand);
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
 * 一张牌是不是「别人塞进这名角色手里」的：`source` 指向另一名参战者（不是自己、也不是未知来源）。
 * 可传递的牌打到谁手里就落在谁手里，所以**我方与怪物都可能被塞牌**，不再限定阵营。
 */
export function isTransferredCard(card: Card, owner: Combatant, combatants: Combatant[]): boolean {
  if (card.source === "" || card.source === owner.name) {
    return false;
  }
  return combatants.some((other) => other.name === card.source);
}

/** 手牌里由别人塞进来的牌数（界面标 [塞牌]，我方与怪物一视同仁）。 */
export function countTransferredCards(combatant: Combatant, combatants: Combatant[]): number {
  return combatant.hand.filter((card) => isTransferredCard(card, combatant, combatants)).length;
}

/**
 * 选中的牌在名单里该被「压下」的目标（原始名）：`self_target` → 自己；`single` → 锚点；
 * `all` / `spread` → 锚点所在阵营的全体存活者。`spread` 与 `all` 的差别只在结算与文案。
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

/** 三个牌堆里的牌；未抓牌时都为空数组。 */
export function readPiles(entity: Entity): CombatPiles {
  return {
    draw: readCards(entity, COMPONENT.DrawPile),
    discard: readCards(entity, COMPONENT.DiscardPile),
    exhaust: readCards(entity, COMPONENT.ExhaustPile),
  };
}

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
