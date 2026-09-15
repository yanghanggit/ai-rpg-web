/**
 * mock 用的内存任务表。
 *
 * 让 `pnpm dev:mock` 下「动作 → job_id → SSE 监听 → 终态」这条链路能完整走通，
 * 行为对齐真实后端（procrastinate）：任务从 `doing` 开始，过一段时间自动 `succeeded`；
 * 未知 job_id 推送 `task_not_found`（后端也是推 `{ "error": ... }` 事件）。
 *
 * 状态不持久：刷新页面后任务表仍在（模块级 Map），重启 dev server 才清空。
 */
import type { Schemas } from "../api/types";

/** mock 任务从创建到完成所需的时间（毫秒）。真实后端约 5 秒。 */
const MOCK_TASK_DURATION_MS = 2_000;

/** mock 版 `watch` 的轮询间隔（毫秒）。 */
const MOCK_WATCH_INTERVAL_MS = 100;

const tasks = new Map<number, { startedAt: number }>();
let sequence = 0;

/** 新建一个 mock 任务，返回其 job_id（后端用自增数字 id）。 */
export function createMockTask(now: number = Date.now()): number {
  sequence += 1;
  const jobId = sequence;
  tasks.set(jobId, { startedAt: now });
  return jobId;
}

/** 按后端契约返回任务状态；不存在的 id 直接跳过。 */
export function readMockTasks(
  jobIds: readonly number[],
  now: number = Date.now(),
): Schemas["TaskSnapshot"][] {
  const result: Schemas["TaskSnapshot"][] = [];
  for (const jobId of jobIds) {
    const task = tasks.get(jobId);
    if (!task) {
      continue;
    }
    const completed = now - task.startedAt >= MOCK_TASK_DURATION_MS;
    result.push({
      job_id: jobId,
      status: completed ? "succeeded" : "doing",
      error: null,
    });
  }
  return result;
}

/** 清空任务表（测试之间隔离用）。 */
export function resetMockTasks(): void {
  tasks.clear();
  sequence = 0;
}

/**
 * 模拟 `GET /api/tasks/v1/watch/{job_id}` 的事件流：每 `intervalMs` 推一次当前状态，
 * 到终态或超时为止；未知 id 推一条 `task_not_found` 后结束。与真实后端 SSE 生成器一致。
 */
export async function* watchMockTask(
  jobId: number,
  { timeoutSeconds = 120, intervalMs = MOCK_WATCH_INTERVAL_MS } = {},
): AsyncGenerator<string> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const task = readMockTasks([jobId])[0];
    if (!task) {
      yield JSON.stringify({ error: "task_not_found", job_id: jobId });
      return;
    }
    yield JSON.stringify(task);
    if (task.status === "succeeded" || task.status === "failed") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  yield JSON.stringify({ error: "timeout", job_id: jobId });
}
