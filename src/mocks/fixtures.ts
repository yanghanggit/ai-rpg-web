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

/**
 * 场景实体（家园运行期）：StageComponent + EnvironmentComponent。
 * 环境叙述在真实后端由 `EnvironmentInitializationSystem` 用 LLM 生成；mock 里给固定文本。
 */
export const stageEntityFixtures: Schemas["EntitySerialization"][] = blueprintFixture.stages.map(
  (stage) => ({
    name: stage.name,
    components: [
      { name: "StageComponent", data: { name: stage.name } },
      {
        name: "EnvironmentComponent",
        data: {
          name: stage.name,
          narrative: `（mock）${stage.name} 的环境叙述：梁柱森然，灯火幽微。`,
        },
      },
    ],
  }),
);

/**
 * 玩家实体的序列化数据（家园运行期）。
 *
 * 玩家实体在 Identity / Appearance / CharacterStats 之外额外挂 PlayerComponent，
 * 所以 group / details 两个端点用它当返回体。字段形状照抄后端 `model_dump()`：
 * CharacterStatsComponent 的 stats 是嵌套对象。
 */
export const playerEntityFixture: Schemas["EntitySerialization"] = {
  name: blueprintFixture.player_actor,
  components: [
    { name: "PlayerComponent", data: { player_name: "webdev" } },
    {
      name: "IdentityComponent",
      data: {
        name: blueprintFixture.player_actor,
        creation_order: 2,
        entity_id: "00000000-0000-0000-0000-0000000000aa",
      },
    },
    {
      name: "AppearanceComponent",
      data: {
        name: blueprintFixture.player_actor,
        base_body: "（mock）清瘦的青年，着一身洗得发白的青布长衫。",
        appearance: "（mock）清瘦的青年，着青布长衫，腰间悬着一柄缠麻短刃。",
      },
    },
    {
      name: "CharacterStatsComponent",
      data: {
        name: blueprintFixture.player_actor,
        stats: { hp: 12, max_hp: 15, attack: 3, defense: 1 },
      },
    },
  ],
};

/**
 * NPC 实体（家园运行期）：NPC / Identity / Appearance / CharacterStats。
 * 没有 PlayerComponent（那是玩家专属）；是否穿时装由 `mocks/items.ts` 的运行时状态决定。
 * 带 `NPCComponent` 才能成为队伍候选（后端 `add_party_member` 会校验，契约见
 * `game/dbg_game.py`：NPC → NPCComponent，Monster → MonsterComponent，玩家 → PlayerComponent）。
 */
export const npcEntityFixtures: Schemas["EntitySerialization"][] = [
  {
    name: "角色.顾知秋",
    components: [
      { name: "NPCComponent", data: { name: "角色.顾知秋" } },
      {
        name: "IdentityComponent",
        data: {
          name: "角色.顾知秋",
          creation_order: 1,
          entity_id: "00000000-0000-0000-0000-0000000000bb",
        },
      },
      {
        name: "AppearanceComponent",
        data: {
          name: "角色.顾知秋",
          base_body: "（mock）身量高挑的女子。",
          appearance: "（mock）着朱砂暗纹道袍的女子。",
        },
      },
      {
        name: "CharacterStatsComponent",
        data: { name: "角色.顾知秋", stats: { hp: 18, max_hp: 18, attack: 5, defense: 2 } },
      },
    ],
  },
  {
    name: "角色.小厮",
    components: [
      { name: "NPCComponent", data: { name: "角色.小厮" } },
      {
        name: "IdentityComponent",
        data: {
          name: "角色.小厮",
          creation_order: 3,
          entity_id: "00000000-0000-0000-0000-0000000000cc",
        },
      },
      {
        name: "AppearanceComponent",
        data: {
          name: "角色.小厮",
          base_body: "（mock）瘦小的少年。",
          appearance: "（mock）一身短打的小厮。",
        },
      },
      {
        name: "CharacterStatsComponent",
        data: { name: "角色.小厮", stats: { hp: 8, max_hp: 8, attack: 1, defense: 0 } },
      },
    ],
  },
];

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
 * 运行期道具（背包 / 储物箱）与穿戴中时装。
 *
 * 蓝图 fixture 里的容器内容被 `collectItemContainers.test.ts` 精确断言，不动它；
 * 这里是「已开局的家园」的运行期状态，比蓝图初始内容多几件，专供道具管理浮窗的 mock。
 */
export const runtimeInventoryFixture: Record<string, unknown>[] = [
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
];

/** 运行期道具：储物箱（材料两种、装备一件、时装一件）。 */
export const runtimeStorageFixture: Record<string, unknown>[] = [
  {
    name: "材料.旧麻绳",
    uuid: "00000000-0000-0000-0000-000000000003",
    type: "MaterialItem",
    description: "（mock）已泛黄，但韧劲仍在。",
    count: 3,
  },
  {
    name: "材料.符纸残片",
    uuid: "00000000-0000-0000-0000-000000000004",
    type: "MaterialItem",
    description: "（mock）边角焦黑的黄符残片。",
    count: 2,
  },
  {
    name: "装备.铁刀",
    uuid: "00000000-0000-0000-0000-000000000005",
    type: "GearItem",
    description: "（mock）样式朴素的铁刀。",
    count: 1,
    resources: [],
    cards: [],
  },
  {
    name: "时装.青衫",
    uuid: "00000000-0000-0000-0000-000000000006",
    type: "CostumeItem",
    description: "（mock）浆洗得发白的青布长衫。",
    count: 1,
    resources: [],
  },
];

/** 穿戴中的时装（`WornCostumeComponent` 的运行期状态，蓝图里没有）。 */
export const wornCostumesFixture: { wearer: string; item: Record<string, unknown> }[] = [
  {
    wearer: "角色.顾知秋",
    item: {
      name: "时装.朱砂袍",
      uuid: "00000000-0000-0000-0000-000000000007",
      type: "CostumeItem",
      description: "（mock）绯色暗纹的道袍。",
      count: 1,
      resources: [],
    },
  },
];

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

/** 空文生图数据（GeneratedImage 的默认形态）。 */
const emptyImage: Schemas["GeneratedImage"] = {
  filename: "",
  url: "",
  prompt: "",
  model: "",
  local_path: "",
};

function dungeonActor(
  name: string,
  type: Schemas["ActorType"],
  stats: Schemas["CharacterStats"],
): Schemas["Actor"] {
  return {
    name,
    type,
    profile: "（mock）角色简介",
    base_body: "（mock）基础身体",
    system_message: "（mock）角色系统提示",
    character_stats: stats,
    components: [],
  };
}

function dungeonStage(name: string, actors: Schemas["Actor"][]): Schemas["Stage"] {
  return {
    name,
    type: "Dungeon",
    profile: `（mock）${name} 的场景简介。`,
    system_message: "（mock）场景系统提示",
    actors,
    components: [],
  };
}

/**
 * 副本（**静态模型数据**）：`GET /api/home/dungeon-list/v1/` 返回的形状。
 *
 * 真实后端把副本存成磁盘 JSON（`game/config.py` 的 `DUNGEONS_DIR`），该接口读取全部文件。
 * 这里给一个开场房间（无敌人）+ 一个战斗房间（含怪物），使「查阅」视图有意义。
 */
export const dungeonFixture: Schemas["Dungeon"] = {
  name: "副本.荒村义庄",
  profile: "（mock）荒村外的旧义庄：停柩不腐，夜里似有人影走动。",
  created_at: "2026-09-11T12:00:00Z",
  current_room_index: -1,
  setup_entities: false,
  image: emptyImage,
  rooms: [
    {
      type: "opening",
      initialized: false,
      image: emptyImage,
      stage: dungeonStage("场景.义庄前院", []),
    },
    {
      type: "combat",
      image: emptyImage,
      combat: { name: "", state: 0, result: 0, rounds: [], retreated: false },
      stage: dungeonStage("场景.停柩房", [
        dungeonActor("怪物.纸人", "Monster", { hp: 9, max_hp: 9, attack: 3, defense: 1 }),
        dungeonActor("怪物.棺中殭尸", "Monster", {
          hp: 16,
          max_hp: 16,
          attack: 5,
          defense: 2,
        }),
      ]),
    },
  ],
};

/**
 * 空副本：后端 `world.dungeon` 的初始值（`Dungeon(name="", rooms=[], profile="")`）。
 * 没有任何副本时 `GET /api/dungeons/v1/{user}/{game}/state` 返回它，`current_room_index = -1`
 * 就是客户端判断「当前没有副本在跑」的依据。
 */
export const emptyDungeonFixture: Schemas["Dungeon"] = {
  name: "",
  rooms: [],
  profile: "",
  current_room_index: -1,
  setup_entities: false,
  image: emptyImage,
};
