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
import { appendMockSessionMessage, readMockSessionMessages } from "./sessionMessages";
import { sseResponse } from "./sseResponse";
import { moveMockPlayerToStage, readMockStages } from "./stages";
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
    const conditions = new URL(request.url).searchParams.getAll("all_of");
    if (conditions.includes("PlayerComponent")) {
      return HttpResponse.json({ entities: [readMockPlayerEntity()] });
    }
    if (conditions.includes("WornCostumeComponent")) {
      return HttpResponse.json({ entities: readMockWornEntities() });
    }
    if (conditions.includes("StorageComponent")) {
      return HttpResponse.json({ entities: [readMockStorageEntity()] });
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
        entities.push(actor);
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

  // 增量拉取：只返回 sequence_id 更大的消息
  http.get(api("/api/session_messages/v1/:userName/:gameName/since"), ({ request }) => {
    const since = Number(new URL(request.url).searchParams.get("last_sequence_id") ?? 0);
    return HttpResponse.json({ session_messages: readMockSessionMessages(since) });
  }),
];
