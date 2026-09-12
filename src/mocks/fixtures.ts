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

/** 后端根路由 `/` 的响应；字段由 ServerInfoResponse 契约保证，无需手写收窄。 */
export const serverInfoFixture: Schemas["ServerInfoResponse"] = {
  service: "AI RPG DBG Game Server",
  base_url: "http://localhost:8000/",
  description: "（mock）AI RPG DBG Game Server API Root Endpoint",
  status: "healthy",
  timestamp: "2026-09-11T12:00:00",
  version: "0.0.1",
  routes: [],
};

function actor(
  name: string,
  type: Schemas["ActorType"],
  components: Schemas["ComponentSerialization"][] = [],
): Schemas["Actor"] {
  return {
    name,
    type,
    profile: "（mock）角色简介",
    base_body: "（mock）基础身体",
    system_message: "（mock）角色系统提示",
    character_stats: { hp: 15, max_hp: 15, attack: 3, defense: 1 },
    components,
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
      actors: [
        actor("角色.顾知秋", "NPC"),
        // 玩家角色的随身背包：字段形状照抄真实后端的 Item（含 uuid / count / 逐类型的额外字段）
        actor("角色.无名", "NPC", [
          {
            name: "InventoryComponent",
            data: {
              name: "角色.无名",
              items: [
                {
                  name: "装备.缠麻短刃",
                  uuid: "00000000-0000-0000-0000-000000000001",
                  type: "GearItem",
                  description: "（mock）由旧铁剪反复磨砺而成的短刃。",
                  count: 1,
                  resources: [],
                  cards: [],
                },
                {
                  name: "消耗品.吗啡针剂",
                  uuid: "00000000-0000-0000-0000-000000000002",
                  type: "ConsumableItem",
                  description: "（mock）淡琥珀色的玻璃针剂。",
                  count: 2,
                  on_use_prompt: ["（mock）恢复 4 点 HP。"],
                  resources: [],
                },
              ],
            },
          },
        ]),
      ],
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
    {
      name: "世界.储物箱",
      system_message: "（mock）",
      components: [
        {
          name: "StorageComponent",
          data: {
            name: "世界.储物箱",
            items: [
              {
                name: "材料.旧麻绳",
                uuid: "00000000-0000-0000-0000-000000000003",
                type: "MaterialItem",
                description: "（mock）已泛黄，但韧劲仍在。",
                count: 3,
                resources: [],
              },
            ],
          },
        },
      ],
    },
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

/**
 * 会话消息（叙事）。覆盖多种 agent_event 类型（字符串字面量，与后端 models/agent_event.py 一致），
 * 其中最后一条用未分类的 `NoneEvent`（`type` 为 "none"）测渲染兜底。
 */
export const sessionMessagesFixture: Schemas["SessionMessage"][] = [
  {
    sequence_id: 1,
    agent_event: {
      type: "mind",
      message: "（mock）# 角色.顾知秋 内心活动: 门厅里静得反常。",
      actor: "角色.顾知秋",
      stage: "场景.门厅",
      content: "门厅里静得反常。",
    },
  },
  {
    sequence_id: 2,
    agent_event: {
      type: "speak",
      message: "（mock）# 角色.顾知秋 对 角色.无名 说: 这位先生，你到此几日哉？",
      actor: "角色.顾知秋",
      stage: "场景.门厅",
      target: "角色.无名",
      content: "这位先生，你到此几日哉？",
    },
  },
  {
    sequence_id: 3,
    agent_event: {
      type: "announce",
      message: "（mock）宣布：堂中灯火忽地一暗。",
      actor: "旁白",
      stage: "场景.门厅",
      content: "堂中灯火忽地一暗。",
    },
  },
  {
    sequence_id: 4,
    agent_event: {
      type: "trans_stage",
      message: "（mock）角色.无名 由 场景.门厅 移至 场景.一楼客房。",
      actor: "角色.无名",
      stage: "场景.门厅",
      target: "场景.一楼客房",
    },
  },
  {
    sequence_id: 5,
    agent_event: {
      type: "none",
      message: "（mock）未分类事件：引擎输出的兜底形态。",
    },
  },
];
