/**
 * ECS 组件类名常量（只列前端实际读取的组件）。
 *
 * 组件 key 在契约里只是 `string`，拼错不报编译错、只静默少一块数据。每个值都经 `name()` 校验为
 * 后端注册表里的类名（`pnpm gen:api` 生成）：后端改名后重新生成，`tsc` 会直接在对应行报错。
 */
import type { ApiComponentName } from "../../api/componentRegistry";

/** 在编译期把值钉死为后端注册表里的组件类名。 */
const name = (value: ApiComponentName) => value;

export const COMPONENT = {
  Appearance: name("AppearanceComponent"),
  CharacterStats: name("CharacterStatsComponent"),
  Death: name("DeathComponent"),
  Deck: name("DeckComponent"),
  DiscardPile: name("DiscardPileComponent"),
  DrawPile: name("DrawPileComponent"),
  Environment: name("EnvironmentComponent"),
  EquippedGear: name("EquippedGearComponent"),
  ExhaustPile: name("ExhaustPileComponent"),
  Hand: name("HandComponent"),
  Identity: name("IdentityComponent"),
  Inventory: name("InventoryComponent"),
  Loot: name("LootComponent"),
  Monster: name("MonsterComponent"),
  NPC: name("NPCComponent"),
  PartyMember: name("PartyMemberComponent"),
  PartyRoster: name("PartyRosterComponent"),
  Player: name("PlayerComponent"),
  PlayerAudit: name("PlayerAuditComponent"),
  RoundStats: name("RoundStatsComponent"),
  Spoils: name("SpoilsComponent"),
  Stage: name("StageComponent"),
  Storage: name("StorageComponent"),
  World: name("WorldComponent"),
  WornCostume: name("WornCostumeComponent"),
} as const;

export type ComponentName = (typeof COMPONENT)[keyof typeof COMPONENT];
