/**
 * mock 用的内存任务表。
 *
 * 让 `pnpm dev:mock` 下「动作 → job_id → 轮询 → 终态」这条链路能完整走通，
 * 行为对齐真实后端（procrastinate）：任务从 `doing` 开始，过一段时间自动 `succeeded`；
 * 未知 job_id 返回空列表（后端也是 `{ "tasks": [] }`）。
 *
 * 状态不持久：刷新页面后任务表仍在（模块级 Map），重启 dev server 才清空。
 */
import type { Schemas } from "../api/types";

/** mock 任务从创建到完成所需的时间（毫秒）。真实后端约 5 秒。 */
const MOCK_TASK_DURATION_MS = 2_000;

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
): Schemas["TaskStatusView"][] {
  const result: Schemas["TaskStatusView"][] = [];
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
