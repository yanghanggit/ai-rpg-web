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
import { COMPONENT } from "../features/entities/componentNames";

/** 后端根路由 `/` 的响应；字段由 ServerInfoResponse 契约保证，无需手写收窄。 */
export const serverInfoFixture: Schemas["ServerInfoResponse"] = {
  service: "AI RPG DBG Game Server",
  base_url: "http://localhost:8000/",
  assets_url_prefix: "/assets/image",
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
    assets: {},
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
            name: COMPONENT.Inventory,
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
      assets: {},
    },
    {
      name: "场景.一楼客房",
      type: "Home",
      profile: "（mock）一楼客房",
      system_message: "（mock）",
      actors: [actor("角色.小厮", "NPC")],
      components: [],
      assets: {},
    },
    {
      name: "场景.二楼卧室",
      type: "Home",
      profile: "（mock）二楼卧室",
      system_message: "（mock）",
      actors: [],
      components: [],
      assets: {},
    },
  ],
  world_entities: [
    { name: "世界.玩家行动审计系统", system_message: "（mock）", components: [] },
    { name: "世界.副本生成系统", system_message: "（mock）", components: [] },
    { name: "世界.插图提示词", system_message: "（mock）", components: [] },
    {
      name: "世界.储物箱",
      system_message: "（mock）",
      components: [
        {
          name: COMPONENT.Storage,
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
  actors_by_stage: Object.fromEntries(
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
      { name: COMPONENT.Stage, data: { name: stage.name } },
      {
        name: COMPONENT.Environment,
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
 *
 * **只序列化客户端会读的组件**：后端的 `SystemMessage`（客户端不允许读）与 `ActorComponent`
 * （只有 `name` / `current_stage`，暂无用途）不列入——mock 不是后端响应的完整镜像。
 */
export const playerEntityFixture: Schemas["EntitySerialization"] = {
  name: blueprintFixture.player_actor,
  components: [
    { name: COMPONENT.Player, data: { player_name: "webdev" } },
    {
      name: COMPONENT.Identity,
      data: {
        name: blueprintFixture.player_actor,
        creation_order: 2,
        entity_id: "00000000-0000-0000-0000-0000000000aa",
      },
    },
    {
      name: COMPONENT.Appearance,
      data: {
        name: blueprintFixture.player_actor,
        base_body: "（mock）清瘦的青年，着一身洗得发白的青布长衫。",
        appearance: "（mock）清瘦的青年，着青布长衫，腰间悬着一柄缠麻短刃。",
      },
    },
    {
      name: COMPONENT.CharacterStats,
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
      { name: COMPONENT.NPC, data: { name: "角色.顾知秋" } },
      {
        name: COMPONENT.Identity,
        data: {
          name: "角色.顾知秋",
          creation_order: 1,
          entity_id: "00000000-0000-0000-0000-0000000000bb",
        },
      },
      {
        name: COMPONENT.Appearance,
        data: {
          name: "角色.顾知秋",
          base_body: "（mock）身量高挑的女子。",
          appearance: "（mock）着朱砂暗纹道袍的女子。",
        },
      },
      {
        name: COMPONENT.CharacterStats,
        data: { name: "角色.顾知秋", stats: { hp: 18, max_hp: 18, attack: 5, defense: 2 } },
      },
    ],
  },
  {
    name: "角色.小厮",
    components: [
      { name: COMPONENT.NPC, data: { name: "角色.小厮" } },
      {
        name: COMPONENT.Identity,
        data: {
          name: "角色.小厮",
          creation_order: 3,
          entity_id: "00000000-0000-0000-0000-0000000000cc",
        },
      },
      {
        name: COMPONENT.Appearance,
        data: {
          name: "角色.小厮",
          base_body: "（mock）瘦小的少年。",
          appearance: "（mock）一身短打的小厮。",
        },
      },
      {
        name: COMPONENT.CharacterStats,
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

/**
 * 副本蓝图里的一个 actor（怪物）。
 *
 * **玩家 / NPC / 怪物挂同一套公共组件**（真实后端 `dbg_game.py::create_actor_entities`）：
 * `IdentityComponent` / `AppearanceComponent`（`appearance` 初始 = `base_body`）/ `CharacterStatsComponent`，
 * 只在类型标记上分岔（`PlayerComponent` / `NPCComponent` / `MonsterComponent`）。所以 `base_body`
 * 是每个 actor 都有的数据，怪物也必须给——否则「角色信息」浮窗的外观栏就是空的。
 */
function dungeonActor(
  name: string,
  type: Schemas["ActorType"],
  stats: Schemas["CharacterStats"],
  baseBody: string,
): Schemas["Actor"] {
  return {
    name,
    type,
    profile: "（mock）角色简介",
    base_body: baseBody,
    system_message: "（mock）角色系统提示",
    character_stats: stats,
    components: [],
    assets: {},
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
    assets: {},
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
  assets: {},
  archive_summary: "",
  rooms: [
    {
      type: "opening",
      initialized: false,
      stage: dungeonStage("场景.义庄前院", []),
    },
    {
      type: "combat",
      combat: { name: "", state: 0, result: 0, rounds: [], retreated: false },
      stage: dungeonStage("场景.停柩房", [
        dungeonActor(
          "怪物.纸人",
          "Monster",
          { hp: 9, max_hp: 9, attack: 3, defense: 1 },
          "（mock）薄纸糊成的纸人，脸上画着朱砂笑眼，风一吹便有簌簌的纸响。",
        ),
        dungeonActor(
          "怪物.棺中殭尸",
          "Monster",
          {
            hp: 16,
            max_hp: 16,
            attack: 5,
            defense: 2,
          },
          "（mock）棺木爆开处爬出的殭尸，浑身裹着霉烂的殓布，指爪青黑。",
        ),
        dungeonActor(
          "怪物.纸傀儡",
          "Monster",
          { hp: 7, max_hp: 7, attack: 2, defense: 0 },
          "（mock）一具提线纸傀儡，关节用麻绳系着，走起来哔哒作响。",
        ),
        dungeonActor(
          "怪物.吊死鬼",
          "Monster",
          { hp: 12, max_hp: 12, attack: 4, defense: 1 },
          "（mock）悬在梁上的吊死鬼，脚不沾地，脖颈勒出一道乌痕。",
        ),
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
  assets: {},
  archive_summary: "",
};

/**
 * 构造一份战斗数据（`Combat`）：战斗 mock 与战斗房间测试共用。
 *
 * 默认是「刚进战斗房间」的形态（`state = NONE`、无回合），各 phase 用例按需覆盖。
 * 状态取值见 `features/dungeon/combat/combatPhase.ts::COMBAT_STATE`。
 */
export function combatFixture(overrides: Partial<Schemas["Combat"]> = {}): Schemas["Combat"] {
  return {
    name: "（mock）停柩房战斗",
    state: 0,
    result: 0,
    rounds: [],
    retreated: false,
    ...overrides,
  };
}

/**
 * 构造一个战斗回合（`Round`）：默认「回合已开、尚未抓牌」的空白回合。
 *
 * 字段名与后端 `models/combat.py::Round` 一致；`current_actor` 用 `null`（而非省略）表示
 * 「无行动角色」，与序列化后的形状一致。
 */
export function roundFixture(overrides: Partial<Schemas["Round"]> = {}): Schemas["Round"] {
  return {
    completed_actors: [],
    action_order: [],
    current_actor: null,
    is_completed: false,
    draw_completed: false,
    cards_log: [],
    cards_narrative: [],
    consumable_log: [],
    consumable_narrative: [],
    consumable_use_count: 0,
    gear_log: [],
    gear_narrative: [],
    gear_equip_count: 0,
    artifact_log: [],
    artifact_narrative: [],
    ...overrides,
  };
}

/**
 * 构造一个战斗房间（`CombatRoom`）：`GET /api/dungeons/v1/{user}/{game}/room` 的 `room`。
 *
 * `stage` 省略时给一个空场景（测试只关心 `combat` 时不必提供参战者）。
 */
export function combatRoomFixture(
  options: { stage?: Schemas["Stage"]; combat?: Partial<Schemas["Combat"]> } = {},
): Schemas["CombatRoom"] {
  return {
    type: "combat",
    stage: options.stage ?? dungeonStage("场景.停柩房", []),
    combat: combatFixture(options.combat),
  };
}

/**
 * 构造一个开场房间（`OpeningRoom`）：`GET .../room` 的 `room` 的 `opening` 分支。
 *
 * 只需要一个入参：开场房间的房间侧状态就只有 `initialized` 一个字段（叙事 + 牌库初始化），
 * 奖励是否存在挂在队伍成员身上，不在房间上。
 */
export function openingRoomFixture(initialized = false): Schemas["OpeningRoom"] {
  return {
    type: "opening",
    stage: dungeonStage("场景.义庄前院", []),
    initialized,
  };
}

/**
 * 卡牌载荷（后端 `Card.model_dump()` 的形状：`DeckComponent` 的 `cards`、`SpoilsComponent`
 * 的 `candidate_cards` / `claimed_cards`）。
 *
 * 牌名**不带** `类型.` 前缀——后端卡牌名就是叙事化的牌名（原型见 `demo/card_prototypes.py`，
 * 由 Agent 在开场/奖励（Spoils）阶段润色），所以展示时也不走 `displayName`。
 */
function mockCard(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name,
    description: `（mock）${name}的叙事描述。`,
    on_play_affixes: [],
    on_hit_affixes: [],
    on_turn_end_affixes: [],
    playable: true,
    exhaust: false,
    retain: false,
    ethereal: false,
    transferable: false,
    cost: 1,
    damage: 1,
    hit_count: 1,
    block: 0,
    target_type: "single",
    self_target: false,
    source: "",
    uuid: `mock-card-${name}`,
    ...overrides,
  };
}

/** 几张示例卡，覆盖卡面上的各种部件（数值 / 多段 / 自身目标 / 阵营散射 / 消耗 / 不可出牌 / 词缀）。 */
export const cardFixtures = {
  cleave: mockCard("剖棺", {
    cost: 1,
    damage: 3,
    // 前 5 张手牌里给一张带**时机词缀**的：回合界面上点它就能试「点词缀 → 详情右栏高亮」那条链路
    on_play_affixes: ["[开棺]:命中后可以再摸一张"],
    source: "角色.无名",
    transferable: true,
  }),
  sweep: mockCard("撬棍横击", {
    cost: 2,
    damage: 2,
    hit_count: 2,
    on_play_affixes: ["[破竹]:本段命中后更容易击穿格挡"],
    source: "角色.顾知秋",
    transferable: true,
  }),
  breath: mockCard("屏息", {
    description: "（mock）贴着棺壁屏住呼吸，把手里的家伙握稳。",
    cost: 1,
    damage: 0,
    block: 3,
    self_target: true,
  }),
  spark: mockCard("火折子", {
    description: "（mock）吹亮火折子，只此一次的爆亮。",
    cost: 0,
    damage: 5,
    exhaust: true,
  }),
  paper: mockCard("撒纸钱", {
    cost: 2,
    damage: 1,
    hit_count: 3,
    target_type: "spread",
    on_turn_end_affixes: ["[纸灰]:回合结束时纸灰未落，气场不散"],
  }),
  ward: mockCard("镇棺符", {
    description: "（mock）贴在棺头的镇物，只在手里才管用。",
    cost: 1,
    damage: 0,
    block: 2,
    retain: true,
    self_target: true,
  }),
  passive: mockCard("常驻厌胜", {
    description: "（mock）缝在衣里的厌胜之物，靠它自己起作用。",
    cost: 0,
    damage: 0,
    playable: false,
    retain: false,
  }),
  nail: mockCard("钉棺", {
    description: "（mock）抡起枣木钉，一钉一钉楔进棺盖的缝。",
    cost: 1,
    damage: 2,
    hit_count: 2,
    on_hit_affixes: ["[入木]:命中的段数越多，棺盖越难再开"],
    source: "角色.无名",
    transferable: true,
  }),
  bell: mockCard("摇铃", {
    description: "（mock）摄魂铃一响，满堂的纸人都慢半拍。",
    cost: 2,
    damage: 0,
    block: 3,
    target_type: "all",
  }),
  shroud: mockCard("裹尸布", {
    description: "（mock）随手扯下的白布，缠在臂上挡一挡。",
    cost: 1,
    damage: 0,
    block: 4,
    retain: true,
    self_target: true,
  }),
  lantern: mockCard("引魂灯", {
    description: "（mock）灯芯只够燃一瞬，灭前把路照穿。",
    cost: 3,
    damage: 6,
    ethereal: true,
  }),
  chant: mockCard("诵经", {
    description: "（mock）低声诵一段往生咒，压住翻涌的阴气。",
    cost: 1,
    damage: 0,
    block: 2,
    on_turn_end_affixes: ["[余音]:回合结束时余音未散，护持仍在"],
  }),
  mirror: mockCard("照妖镜", {
    description: "（mock）铜镜一转，把光碎成数道抛向四面。",
    cost: 2,
    damage: 3,
    target_type: "spread",
  }),
};

/** 队伍成员的初始牌组（按角色名）。未列出的角色用默认牌组。 */
/**
 * 各成员的固定牌组。
 *
 * 张数故意拉开：玩家 9 张（三行满）、顾知秋 5 张（最后一行不满、居中）、小厮 2 张——
 * 这样「牌组」浏览里一行三张、多行、末行居中这三种情形在 mock 下都能一眼看到。
 *
 * 玩家的**前 5 张 = 每回合抓到手的那一把**（`MOCK_DRAW_PER_TURN = 5`，按数组顺序抓），所以把
 * `single`（剖棺）/ `self_target`（屏息）/ 不可出牌（常驻厌胜）/ `spread`（照妖镜）/ `all`（摇铃）
 * 这五种目标类型各摆一张在手牌里，方便直接在回合界面上试选目标。
 */
export const deckFixtures: Record<string, Record<string, unknown>[]> = {
  [blueprintFixture.player_actor]: [
    cardFixtures.cleave,
    cardFixtures.breath,
    cardFixtures.passive,
    cardFixtures.mirror,
    cardFixtures.bell,
    cardFixtures.nail,
    cardFixtures.shroud,
    cardFixtures.lantern,
    cardFixtures.chant,
  ],
  "角色.顾知秋": [
    cardFixtures.sweep,
    cardFixtures.ward,
    cardFixtures.nail,
    cardFixtures.bell,
    cardFixtures.chant,
  ],
  "角色.小厮": [cardFixtures.cleave, cardFixtures.shroud],
};

export const defaultDeckFixture: Record<string, unknown>[] = [cardFixtures.cleave];

/**
 * `棺中殭尸` 多出来的那一段牌组（加在它原本的 5 张后面）。
 *
 * 为什么偏偏给它加长：卡牌列表浮窗（牌组 / 手牌 / 牌堆）是**固定三行 × 三列、超出在框内滚动**的，
 * 而 3×3 = 9 张正是它的临界值——手牌 5 张、别家牌组 5 张都碰不到那条线，**滚动与裁切在 mock 里
 * 根本走不到**。补到 15 张后：牌组浮窗 5 行、抽牌堆（15 减每回合抳的 5）4 行，两处都要滚，
 * `dev:mock` 下一眼能看出「高度固定、里面滚」是不是想要的效果。
 *
 * 前 5 张（`cleave / breath / nail / shroud / bell`）是它每回合抓到手里的那一把，不能动——
 * 手牌上的【塞牌】/【被动】演示靠它们。这里的牌名也不能与那 5 张重名（uuid 由牌名推出来）。
 */
const coffinExtraCards = [
  mockCard("掐颈", { cost: 1, damage: 2 }),
  mockCard("尸气", {
    description: "（mock）吐出一口积在棺里的浊气，满室无风自动。",
    cost: 1,
    damage: 0,
    target_type: "all",
    on_turn_end_affixes: ["[尸毒]:回合结束时尸毒未散，仍在渗"],
  }),
  mockCard("破棺", { cost: 2, damage: 4, exhaust: true }),
  mockCard("啃噬", { cost: 0, damage: 1, hit_count: 3 }),
  mockCard("腐血", {
    description: "（mock）指节一挤，黑血流下。",
    cost: 1,
    damage: 2,
    on_hit_affixes: ["[蚀骨]:命中的段数越多，护体越薄"],
  }),
  mockCard("僵直", { cost: 1, damage: 0, block: 5, self_target: true }),
  mockCard("拖拽", { cost: 1, damage: 2, target_type: "spread" }),
  mockCard("阴风", { cost: 1, damage: 0, block: 3, target_type: "all" }),
  mockCard("怨念", { cost: 0, damage: 0, playable: false }),
  mockCard("立尸", { cost: 2, damage: 3, hit_count: 2, ethereal: true }),
];

/**
 * 副本怪物的固定牌组（按怪物名）。
 *
 * 怪物和队伍成员一样持 `DeckComponent`（后端战斗双方都有牌库，`build_deck_text` 一次列双方），
 * 所以「牌组一览」要能读到它们。只列 `dungeonFixture` 里出现的怪物；未列出的用默认牌组。
 */
export const monsterDeckFixtures: Record<string, Record<string, unknown>[]> = {
  // 前几张混入「来自我方阵营」的牌（`source` 是我方成员）+ 带 `on_hit` 词缀的牌，
  // 这样 `dev:mock` 下能一眼看到名单卡上的 [被动] / [塞牌]（见种子 `combat:turn`）。
  // `spark` / `lantern` 额外把「消耗牌」（橙）/「虚无」（紫）两个布尔标记也铺到一张手牌里，
  // 方便一次看全卡面全部的标记颜色。
  "怪物.纸人": [
    cardFixtures.nail,
    cardFixtures.paper,
    cardFixtures.ward,
    cardFixtures.spark,
    cardFixtures.lantern,
  ],
  "怪物.棺中殭尸": [
    cardFixtures.cleave,
    cardFixtures.breath,
    cardFixtures.nail,
    cardFixtures.shroud,
    cardFixtures.bell,
    ...coffinExtraCards,
  ],
  "怪物.纸傀儡": [
    cardFixtures.nail,
    cardFixtures.sweep,
    cardFixtures.ward,
    cardFixtures.shroud,
    cardFixtures.paper,
  ],
  "怪物.吊死鬼": [
    cardFixtures.nail,
    cardFixtures.bell,
    cardFixtures.chant,
    cardFixtures.mirror,
    cardFixtures.ward,
  ],
};

export const defaultMonsterDeckFixture: Record<string, unknown>[] = [cardFixtures.cleave];

/** 奖励（Spoils）候选（后端 `SPOILS_CARD_COUNT = 3`，3 选 1）。 */
export const spoilsFixture: Record<string, unknown>[] = [
  cardFixtures.spark,
  cardFixtures.paper,
  cardFixtures.ward,
];

/**
 * 副本场景实体（运行期）：`StageComponent` + `EnvironmentComponent`。
 *
 * 从 `dungeonFixture` 的房间派生，场景名与副本数据天然一致；环境叙述在真实后端由
 * `EnvironmentInitializationSystem` 用 LLM 生成（副本初始化时），mock 里给固定文本。
 */
export const dungeonStageEntityFixtures: Schemas["EntitySerialization"][] =
  dungeonFixture.rooms.map((room) => ({
    name: room.stage.name,
    components: [
      { name: COMPONENT.Stage, data: { name: room.stage.name } },
      {
        name: COMPONENT.Environment,
        data: {
          name: room.stage.name,
          narrative: `（mock）${room.stage.name} 的环境叙述：门轴涩住，风从棺缝里过。`,
        },
      },
    ],
  }));
