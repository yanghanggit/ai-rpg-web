/**
 * 后台任务等待：轮询 `GET /api/tasks/v1/status`，直到任务进入终态。
 *
 * 背景：后端绝大多数「动作」接口（advance / player_action / craft / combat ...）返回的是
 * `job_id` 而**不是**新状态，真正的状态变化发生在后台任务（procrastinate）里。
 * 所以「触发 → 等待 → 刷新状态」是通用范式，本 hook 提供中间那一步。
 *
 * 放在 `src/api/` 而非 `src/features/`：job 是 API 契约的一部分
 * （见 docs/conventions.md 三「与契约有关 → 下沉 api/」），
 * 这样各个 feature 也无需互相依赖。
 *
 * 实测后端行为：
 * - 未知（数字）job_id → `{ tasks: [] }`：本 hook 视为「仍未完成」，继续轮询。
 * - 非数字 job_id → HTTP 500（后端 `int(job_id)` 未捕获 ValueError），属后端缺陷，
 *   已记入 docs/api-layer.md 七。
 * - 因此**超时保护是必需的**：id 写错或任务永不终结时，前端不能无限轮询。
 */
import { useEffect, useState } from "react";
import { $api } from "./query";

const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_TIMEOUT_MS = 120_000;

type TaskStatus = "running" | "completed" | "failed";

/** 终态：到了就不必再轮询。 */
function isTerminal(status: TaskStatus | undefined): boolean {
  return status === "completed" || status === "failed";
}

export interface UseTaskOptions {
  /** 轮询间隔（毫秒）。 */
  pollIntervalMs?: number;
  /** 超过该时长仍未进入终态，则停止轮询并置 `isTimedOut`（毫秒）。 */
  timeoutMs?: number;
}

/**
 * @param jobId 后台任务 ID；为 `null`/`undefined`（尚未触发）时不发请求。
 */
export function useTask(jobId: string | null | undefined, options: UseTaskOptions = {}) {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const [isTimedOut, setIsTimedOut] = useState(false);

  // jobId 变化时重新计时；到点后置 isTimedOut，下面的 enabled 随之停止轮询。
  useEffect(() => {
    setIsTimedOut(false);
    if (jobId == null) {
      return;
    }
    const timer = setTimeout(() => setIsTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [jobId, timeoutMs]);

  const query = $api.useQuery(
    "get",
    "/api/tasks/v1/status",
    { params: { query: { job_ids: jobId == null ? [] : [jobId] } } },
    {
      enabled: jobId != null && !isTimedOut,
      // 到达终态就停；超时由上面的 enabled 停（两者都要，否则超时后会继续轮询）。
      refetchInterval: (current) => {
        const found = current.state.data?.tasks.find((item) => item.job_id === jobId);
        return isTerminal(found?.status) ? false : pollIntervalMs;
      },
    },
  );

  const task = query.data?.tasks.find((item) => item.job_id === jobId);
  const status = task?.status;

  return {
    /** 后端返回的任务状态；`undefined` 表示尚未查到该任务（含未知 id）。 */
    status,
    /** 任务失败时后端记录的错误文本。 */
    error: task?.error ?? null,
    /** 轮询本身失败（网络/HTTP 错误），与任务失败是两件事。 */
    pollError: query.error,
    /** 仍在进行中：已触发、未到终态、也未超时。 */
    isRunning: jobId != null && !isTerminal(status) && !isTimedOut,
    isCompleted: status === "completed",
    isFailed: status === "failed",
    /** 超时停止：任务既未完成也未失败，但已不再轮询。 */
    isTimedOut,
  };
}
