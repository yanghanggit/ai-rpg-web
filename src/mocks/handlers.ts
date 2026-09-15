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
import {
  blueprintListFixture,
  homeStagesFixture,
  newGameFixture,
  serverInfoFixture,
} from "./fixtures";
import { appendMockSessionMessage, readMockSessionMessages } from "./sessionMessages";
import { sseResponse } from "./sseResponse";
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
    HttpResponse.json(homeStagesFixture),
  ),

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

  // 增量拉取：只返回 sequence_id 更大的消息
  http.get(api("/api/session_messages/v1/:userName/:gameName/since"), ({ request }) => {
    const since = Number(new URL(request.url).searchParams.get("last_sequence_id") ?? 0);
    return HttpResponse.json({ session_messages: readMockSessionMessages(since) });
  }),
];
