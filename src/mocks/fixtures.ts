/**
 * Mock 数据（fixtures）。
 *
 * 这里是 mock 模式（pnpm dev:mock）与单元测试的**唯一**假数据来源，
 * 避免两边各自维护一套导致漂移。
 *
 * 每个 fixture 都用生成物（schema.d.ts）派生的类型标注：
 * 后端契约一变，pnpm typecheck 就会在这里报错，而不是等到运行时。
 */
import type { Schemas } from "../api/types";

/** 后端根路由 `/` 的响应（对应 serverInfo.ts 的收窄字段）。 */
export const serverInfoFixture = {
  service: "AI RPG DBG Game Server",
  status: "healthy",
  version: "0.0.1",
};

function actor(name: string, type: Schemas["ActorType"]): Schemas["Actor"] {
  return {
    name,
    type,
    profile: "（mock）角色简介",
    base_body: "（mock）基础身体",
    system_message: "（mock）角色系统提示",
    character_stats: { hp: 15, max_hp: 15, attack: 3, defense: 1 },
    components: [],
  };
}

/** 单个蓝图，结构与后端 blueprint-list 返回的 Blueprint 一致。 */
export const blueprintFixture: Schemas["Blueprint"] = {
  name: "Game1",
  player_actor: "角色.无名",
  campaign_setting: "（mock）这是一个架空的、融合狩猎玩法的中式民俗志怪游戏世界。",
  system_rules: "（mock）系统规则",
  knowledge_base: {},
  stages: [
    {
      name: "场景.门厅",
      type: "Home",
      profile: "（mock）门厅",
      system_message: "（mock）",
      actors: [actor("角色.顾知秋", "NPC"), actor("角色.无名", "NPC")],
      components: [],
    },
    {
      name: "场景.一楼客房",
      type: "Home",
      profile: "（mock）一楼客房",
      system_message: "（mock）",
      actors: [actor("角色.小厮", "NPC")],
      components: [],
    },
    {
      name: "场景.二楼卧室",
      type: "Home",
      profile: "（mock）二楼卧室",
      system_message: "（mock）",
      actors: [],
      components: [],
    },
  ],
  world_entities: [
    { name: "世界.玩家行动审计系统", system_message: "（mock）", components: [] },
    { name: "世界.副本生成系统", system_message: "（mock）", components: [] },
    { name: "世界储物箱", system_message: "（mock）", components: [] },
  ],
};

export const blueprintListFixture: Schemas["BlueprintListResponse"] = {
  blueprints: [blueprintFixture],
};

/**
 * 家园 stage → actor 名字映射。
 * 从 blueprintFixture 派生，保证与蓝图一致。
 */
export const homeStagesFixture: Schemas["StagesStateResponse"] = {
  mapping: Object.fromEntries(
    blueprintFixture.stages.map((stage) => [stage.name, stage.actors.map((a) => a.name)]),
  ),
};

export const newGameFixture: Schemas["NewGameResponse"] = {
  blueprint: blueprintFixture,
  player_session: {
    name: "player-mock",
    actor: blueprintFixture.player_actor,
    game: blueprintFixture.name,
    session_messages: [],
    event_sequence: 0,
  },
};
