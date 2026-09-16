/**
 * 默认 MSW handlers。
 *
 * - mock 模式（pnpm dev:mock）：浏览器 worker 用这套 handler 返回 fixtures。
 * - 单元测试：node server 默认挂这套 handler；用例内用 `server.use(...)` 覆盖特定接口。
 *
 * 新增页面需要 mock 时，把该页依赖的接口加到这里即可，测试与调试同时生效。
 */
import { HttpResponse, http } from "msw";
import { API_BASE_URL } from "../api/client";
import type { ApiBody, Schemas } from "../api/types";
import {
  advanceMockDungeon,
  enterMockDungeon,
  exitMockDungeon,
  generateMockDungeon,
  readMockDungeonRoom,
  readMockDungeonState,
  readMockDungeons,
} from "./dungeons";
import {
  blueprintFixture,
  blueprintListFixture,
  newGameFixture,
  serverInfoFixture,
} from "./fixtures";
import {
  craftMockItem,
  moveMockItem,
  readMockActorEntity,
  readMockPlayerEntity,
  readMockStorageEntity,
  readMockStorageEntityName,
  readMockWornEntities,
  removeMockCostume,
  wearMockCostume,
} from "./items";
import {
  generateMockSpoils,
  initMockOpening,
  pickMockSpoilsCard,
  readMockOpeningInitialized,
  readMockPartyEntities,
  readMockSpoilsHolders,
  withMockOpeningComponents,
} from "./opening";
import {
  addMockRosterMember,
  readMockNpcEntities,
  readMockRosterEntities,
  removeMockRosterMember,
} from "./roster";
import { appendMockSessionMessage, readMockSessionMessages } from "./sessionMessages";
import { sseResponse } from "./sseResponse";
import { moveMockPlayerToStage, readMockStageEntity, readMockStages } from "./stages";
import { createMockTask, watchMockTask } from "./tasks";

/** 把后端相对路径补成完整 URL，供 MSW handler 匹配。 */
export function api(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export const handlers = [
  http.get(api("/"), () => HttpResponse.json(serverInfoFixture)),

  http.get(api("/api/game/blueprint-list/v1/"), () => HttpResponse.json(blueprintListFixture)),

  http.post(api("/api/login/v1/"), () => HttpResponse.json({ message: "mock 登录成功" })),

  http.post(api("/api/logout/v1/"), () => HttpResponse.json({ message: "mock 登出成功" })),

  http.post(api("/api/game/new/v1/"), () => HttpResponse.json(newGameFixture)),

  http.get(api("/api/stages/v1/:userName/:gameName/state"), () =>
    HttpResponse.json(readMockStages()),
  ),

  // 玩家身份：后端用 group 端点按组件过滤，玩家是唯一带 PlayerComponent 的实体。
  // 同端点还用于解析储物箱世界实体（WorldComponent + StorageComponent）与穿戴中时装。
  http.get(api("/api/entities/v1/:userName/:gameName/group"), ({ request }) => {
    const searchParams = new URL(request.url).searchParams;
    const conditions = searchParams.getAll("all_of");
    const noneOf = searchParams.getAll("none_of");
    if (conditions.includes("PlayerComponent")) {
      return HttpResponse.json({ entities: [readMockPlayerEntity()] });
    }
    if (conditions.includes("WornCostumeComponent")) {
      return HttpResponse.json({ entities: readMockWornEntities() });
    }
    if (conditions.includes("StorageComponent")) {
      return HttpResponse.json({ entities: [readMockStorageEntity()] });
    }
    // 队伍名单挂在玩家实体上（名单为空时该组件不存在，entities 为空）
    if (conditions.includes("PartyRosterComponent")) {
      return HttpResponse.json({ entities: readMockRosterEntities() });
    }
    // 副本内的队伍（进副本时固化）：持 PartyMemberComponent 的成员，带牌组 / 奖励（Spoils）
    if (conditions.includes("PartyMemberComponent")) {
      return HttpResponse.json({ entities: readMockPartyEntities() });
    }
    // 副本队伍候选：持 NPCComponent 的实体；玩家可能也带 NPCComponent，靠 none_of 排除
    if (conditions.includes("NPCComponent")) {
      return HttpResponse.json({ entities: readMockNpcEntities(noneOf) });
    }
    return HttpResponse.json({ entities: [] });
  }),

  // 实体详情：按名字批量查询（玩家 / NPC / 储物箱），角色信息与道具管理浮窗都用它
  http.get(api("/api/entities/v1/:userName/:gameName/details"), ({ request }) => {
    const names = new URL(request.url).searchParams.getAll("entities");
    const entities: Schemas["EntitySerialization"][] = [];
    for (const name of names) {
      if (name === readMockStorageEntityName()) {
        entities.push(readMockStorageEntity());
        continue;
      }
      const actor = readMockActorEntity(name);
      if (actor) {
        // 副本内的成员还带 PartyMemberComponent / DeckComponent（可能还有 SpoilsComponent）
        entities.push(withMockOpeningComponents(actor));
        continue;
      }
      const stage = readMockStageEntity(name);
      if (stage) {
        entities.push(stage);
      }
    }
    return HttpResponse.json({ entities });
  }),

  // 任务：SSE 监听单个任务至终态，与真实后端 /api/tasks/v1/watch/{job_id} 一致。
  // 真实后端只在终态/超时/任务不存在时结束推送，这里用 watchMockTask 模拟同一条时间线。
  http.get(api("/api/tasks/v1/watch/:jobId"), ({ params, request }) => {
    const jobId = Number(params.jobId);
    const timeoutSeconds = Number(new URL(request.url).searchParams.get("timeout_seconds") ?? 120);
    return sseResponse(watchMockTask(jobId, { timeoutSeconds }));
  }),

  // 家园动作：与真实后端一致，只返回 job_id，结果要靠监听任务状态获得
  http.post(api("/api/home/advance/v1/"), () => {
    // 真实后端里这些叙事由 NPC 行动产生；mock 里直接追一条，好让「推进 → 新叙事」可见
    appendMockSessionMessage({
      type: "announce",
      message: "（mock）家园推进：角色们各自行动了一轮。",
      actor: "旁白",
      stage: "场景.门厅",
      content: "角色们各自行动了一轮。",
    });
    return HttpResponse.json({
      job_id: createMockTask(),
      message: "mock 推进任务已启动",
    });
  }),

  // 切换场景：mock 里直接改场景表 + 追一条 trans_stage 叙事，让位置变化可见
  http.post(api("/api/home/player/switch_stage/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/player/switch_stage/v1/">;
    const origin = moveMockPlayerToStage(body.stage_name);
    appendMockSessionMessage({
      type: "trans_stage",
      message: `（mock）${blueprintFixture.player_actor} 由 ${origin ?? "未知场景"} 移至 ${body.stage_name}。`,
      actor: blueprintFixture.player_actor,
      stage: origin ?? body.stage_name,
      target: body.stage_name,
    });
    return HttpResponse.json({
      job_id: createMockTask(),
      message: "mock 场景切换任务已启动",
    });
  }),

  // 移动道具：同步接口，直接改 mock 内存状态（批量：逐个搬）
  http.post(api("/api/home/item/move_to_inventory/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/item/move_to_inventory/v1/">;
    for (const name of body.item_names) {
      moveMockItem(name, "inventory");
    }
    return HttpResponse.json({ message: "mock 已移入随身背包" });
  }),

  http.post(api("/api/home/item/move_to_storage/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/item/move_to_storage/v1/">;
    for (const name of body.item_names) {
      moveMockItem(name, "storage");
    }
    return HttpResponse.json({ message: "mock 已移入储物箱" });
  }),

  // 工坊合成：消耗储物箱材料 + 追一条叙事，再返回 job_id 走同一条任务时间线
  http.post(api("/api/home/craft/consumable/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/craft/consumable/v1/">;
    craftMockItem("consumable", body.materials);
    return HttpResponse.json({
      job_id: createMockTask(),
      message: "mock 消耗品工坊任务已启动",
    });
  }),

  http.post(api("/api/home/craft/gear/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/craft/gear/v1/">;
    craftMockItem("gear", body.materials);
    return HttpResponse.json({
      job_id: createMockTask(),
      message: "mock 装备工坊任务已启动",
    });
  }),

  http.post(api("/api/home/craft/costume/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/craft/costume/v1/">;
    craftMockItem("costume", body.materials);
    return HttpResponse.json({
      job_id: createMockTask(),
      message: "mock 时装工坊任务已启动",
    });
  }),

  // 穿/脱时装：改 mock 的 worn 状态 + 追一条叙事，再返回 job_id 走同一条任务时间线
  http.post(api("/api/home/costume/wear/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/costume/wear/v1/">;
    if (!wearMockCostume(body.target_name, body.item_name)) {
      return HttpResponse.json({ detail: "储物箱中不存在该时装" }, { status: 400 });
    }
    appendMockSessionMessage({
      type: "announce",
      message: `（mock）${body.target_name} 换上了 ${body.item_name}。`,
      actor: body.target_name,
      stage: "场景.门厅",
      content: `换上了 ${body.item_name}。`,
    });
    return HttpResponse.json({ job_id: createMockTask(), message: "mock 换装任务已启动" });
  }),

  http.post(api("/api/home/costume/remove/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/costume/remove/v1/">;
    if (!removeMockCostume(body.target_name)) {
      return HttpResponse.json({ detail: "该角色未穿戴时装" }, { status: 400 });
    }
    appendMockSessionMessage({
      type: "announce",
      message: `（mock）${body.target_name} 脱下了时装。`,
      actor: body.target_name,
      stage: "场景.门厅",
      content: "脱下了时装。",
    });
    return HttpResponse.json({ job_id: createMockTask(), message: "mock 脱装任务已启动" });
  }),

  // 队伍名单：同步接口，直接改 mock 内存状态；校验口径对齐后端
  http.post(api("/api/home/roster/add/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/roster/add/v1/">;
    const result = addMockRosterMember(body.member_name);
    if (!result.ok) {
      return HttpResponse.json({ detail: result.error }, { status: 400 });
    }
    return HttpResponse.json({ message: `mock 已将 ${body.member_name} 加入队伍` });
  }),

  http.post(api("/api/home/roster/remove/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/roster/remove/v1/">;
    const result = removeMockRosterMember(body.member_name);
    if (!result.ok) {
      return HttpResponse.json({ detail: result.error }, { status: 400 });
    }
    return HttpResponse.json({ message: `mock 已将 ${body.member_name} 从队伍移除` });
  }),

  // 副本列表：磁盘上的静态模型数据，客户端据此做「查阅」
  http.get(api("/api/home/dungeon-list/v1/"), () =>
    HttpResponse.json({ dungeons: readMockDungeons() }),
  ),

  // 副本运行状态：`current_room_index >= 0` 即「有副本正在进行中」
  http.get(api("/api/dungeons/v1/:userName/:gameName/state"), () =>
    HttpResponse.json(readMockDungeonState()),
  ),

  // 进入副本：同步接口（真实后端只返回 message），成功后 mock 的副本状态变为进行中
  http.post(api("/api/home/enter_dungeon/v1/"), async ({ request }) => {
    const body = (await request.json()) as ApiBody<"/api/home/enter_dungeon/v1/">;
    const result = enterMockDungeon(body.dungeon_name);
    if (!result.ok) {
      return HttpResponse.json({ detail: result.error }, { status: 500 });
    }
    appendMockSessionMessage({
      type: "trans_stage",
      message: `（mock）进入副本：${body.dungeon_name}。`,
      actor: blueprintFixture.player_actor,
      stage: "场景.门厅",
      target: "场景.义庄前院",
    });
    return HttpResponse.json({ message: `mock 已进入副本：${body.dungeon_name}` });
  }),

  // 当前副本房间：没有进行中的房间时后端返回 404（客户端不兜底，错误原样显示）
  http.get(api("/api/dungeons/v1/:userName/:gameName/room"), () => {
    const room = readMockDungeonRoom();
    if (room === null) {
      return HttpResponse.json({ detail: "当前副本没有进行中的房间" }, { status: 404 });
    }
    // 开场是否已初始化属于房间状态（真实后端记在 `OpeningRoom.initialized` 上）
    if (room.type === "opening") {
      room.initialized = readMockOpeningInitialized();
    }
    return HttpResponse.json({ room });
  }),

  // 开场房间初始化：任务接口（叙事 + 牌库），mock 里同步切状态并追一条叙事
  http.post(api("/api/dungeon/opening/init/v1/"), () => {
    initMockOpening();
    appendMockSessionMessage({
      type: "announce",
      message: "（mock）开场房间初始化完成。",
      actor: "旁白",
      stage: "场景.义庄前院",
      content: "（mock）开场叙事：门轴涩住，风从棺缝里过。",
    });
    return HttpResponse.json({ job_id: createMockTask(), message: "mock 开场初始化任务已启动" });
  }),

  // 生成奖励（Spoils）：依赖开场已初始化；幂等（已有奖励则后端拒绝，与后端同一守卫）
  http.post(api("/api/dungeon/opening/generate_spoils/v1/"), () => {
    if (!readMockOpeningInitialized()) {
      return HttpResponse.json(
        { detail: "开场房间尚未初始化（叙事 + 牌库），请先调用开场初始化接口" },
        { status: 409 },
      );
    }
    const holders = readMockSpoilsHolders();
    if (holders.length > 0) {
      return HttpResponse.json(
        {
          detail: `奖励已生成（[${holders.map((name) => `'${name}'`).join(", ")}] 已持有 SpoilsComponent），无需重复生成`,
        },
        { status: 409 },
      );
    }
    generateMockSpoils();
    return HttpResponse.json({ job_id: createMockTask(), message: "mock 奖励生成任务已启动" });
  }),

  // 领卡（Spoils 子操作 pick_card）：领完标记 claimed=true（组件与候选保留），与后端同一语义
  http.post(api("/api/dungeon/opening/pick_spoils/pick_card/v1/"), async ({ request }) => {
    const body =
      (await request.json()) as ApiBody<"/api/dungeon/opening/pick_spoils/pick_card/v1/">;
    const result = pickMockSpoilsCard(body.actor_name, body.card_name);
    if (!result.ok) {
      return HttpResponse.json({ detail: result.error }, { status: 409 });
    }
    return HttpResponse.json({ job_id: createMockTask(), message: "mock 领卡任务已启动" });
  }),

  // 进入下一关：**同步**接口（后端就地推进关卡），mock 里同步换房间
  http.post(api("/api/dungeon/progress/advance_stage/v1/"), () => {
    if (!advanceMockDungeon()) {
      return HttpResponse.json({ detail: "副本已全部通关，请返回营地" }, { status: 409 });
    }
    return HttpResponse.json({ message: "已前进到下一关" });
  }),

  // 退出副本：真实后端是异步任务（只返回 job_id），且状态变化由任务完成；
  // mock 里不模拟这个时间差，同步把副本状态复位（与「生成副本」同一做法）
  http.post(api("/api/dungeon/exit/v1/"), () => {
    exitMockDungeon();
    return HttpResponse.json({
      job_id: createMockTask(),
      message: "mock 退出副本任务已启动",
    });
  }),

  // 生成副本：真实后端是异步 pipeline（只返回 job_id），mock 里同步追加一份并追一条叙事
  http.post(api("/api/home/generate_dungeon/v1/"), () => {
    const dungeon = generateMockDungeon();
    appendMockSessionMessage({
      type: "announce",
      message: `（mock）已生成新副本：${dungeon.name}。`,
      actor: "旁白",
      stage: "场景.门厅",
      content: `已生成新副本：${dungeon.name}。`,
    });
    return HttpResponse.json({
      job_id: createMockTask(),
      message: "mock 副本生成任务已启动",
    });
  }),

  // 增量拉取：只返回 sequence_id 更大的消息
  http.get(api("/api/session_messages/v1/:userName/:gameName/since"), ({ request }) => {
    const since = Number(new URL(request.url).searchParams.get("last_sequence_id") ?? 0);
    return HttpResponse.json({ session_messages: readMockSessionMessages(since) });
  }),
];
