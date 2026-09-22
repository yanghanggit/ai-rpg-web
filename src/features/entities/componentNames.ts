/**
 * ECS 组件类名常量。
 *
 * ## 为什么要有这一层
 *
 * 契约里 `ComponentSerialization.name` 只是 `string`（后端支持 `create_component_type`
 * 动态组件类，收窄不成枚举），`ecs.ts` 的读取函数以前也收 `string`。于是类名拼错时
 * TypeScript 不报错，运行时 `hasComponent` 返回 `false`、`getComponentData` 返回
 * `undefined`——各 reader 的设计本就是「读不到就给空值」，结果是界面静默少一块数据、
 * 测试照样绿。组件类名是**能用编译期挡住的**，不该交给运行时。
 *
 * ## 单一事实源
 *
 * 后端 `COMPONENT_TYPES` 注册表（`models/components.py` 等处的 `@register_component_type`）
 * 是唯一事实源。`scripts/genApi.mjs` 把它拉下来生成 `src/api/componentRegistry.ts`，这里
 * 的每个值都经 `name()` 做编译期校验：后端改名或删除组件时，重新 `pnpm gen:api` 后
 * `pnpm typecheck` 会直接在对应行报错，而不是等运行时静默失败。
 *
 * 只列前端实际读取的组件；需要新组件时在此追加一项即可（值必须存在于生成清单）。
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
