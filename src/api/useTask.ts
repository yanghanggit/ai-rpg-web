/**
 * 任务等待：轮询 `GET /api/tasks/v1/status`，直到任务进入终态。
 *
 * 背景：后端绝大多数「动作」接口（advance / player_action / craft / combat ...）返回的是
 * `job_id` 而**不是**新状态，真正的状态变化发生在任务（procrastinate）里。
 * 所以「触发 → 等待 → 刷新状态」是通用范式，本 hook 提供中间那一步。
 *
 * 放在 `src/api/` 而非 `src/features/`：job 是 API 契约的一部分
 * （见 docs/conventions.md 三「与契约有关 → 下沉 api/」），
 * 这样各个 feature 也无需互相依赖。
 *
 * 与后端契约（OpenAPI）对齐：
 * - `job_id` 是整数（procrastinate 的自增 id）。
 * - 任务状态直接用 procrastinate 的原始枚举，后端不做任何映射。
 * - 未知 job_id → `{ tasks: [] }`：本 hook 视为「仍未完成」，继续轮询。
 * - 因此**超时保护是必需的**：id 写错或任务永不终结时，前端不能无限轮询。
 */
import { useEffect, useState } from "react";
import { $api } from "./query";
import type { Schemas } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_TIMEOUT_MS = 120_000;

/** 后端任务状态（procrastinate 原始枚举）。 */
type TaskStatus = Schemas["Status"];

/**
 * 终态：到了就不必再轮询。
 *
 * 只认 `succeeded` / `failed`，与后端 `/watch` 的终止条件一致；
 * 后端从不 cancel/abort，故不处理 cancelled/aborted。
 */
function isTerminal(status: TaskStatus | undefined): boolean {
  return status === "succeeded" || status === "failed";
}

export interface UseTaskOptions {
  /** 轮询间隔（毫秒）。 */
  pollIntervalMs?: number;
  /** 超过该时长仍未进入终态，则停止轮询并置 `isTimedOut`（毫秒）。 */
  timeoutMs?: number;
}

/**
 * @param jobId 任务 ID；为 `null`/`undefined`（尚未触发）时不发请求。
 */
export function useTask(jobId: number | null | undefined, options: UseTaskOptions = {}) {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const [isTimedOut, setIsTimedOut] = useState(false);

  const query = $api.useQuery(
    "get",
    "/api/tasks/v1/status",
    { params: { query: { job_ids: jobId == null ? [] : [jobId] } } },
    {
      enabled: jobId != null && !isTimedOut,
      // 到达终态就停；超时由下面的 enabled 停（两者都要，否则超时后会继续轮询）。
      refetchInterval: (current) => {
        const found = current.state.data?.tasks.find((item) => item.job_id === jobId);
        return isTerminal(found?.status) ? false : pollIntervalMs;
      },
    },
  );

  const task = query.data?.tasks.find((item) => item.job_id === jobId);
  const status = task?.status;
  const terminal = isTerminal(status);

  /**
   * jobId 变化时重新计时；**到点仍未终态**才置 isTimedOut，随后 enabled 停止轮询。
   *
   * 依赖 terminal 这个**布尔值**而非 status：轮询期间它稳定为 false，定时器不会被反复
   * 重置；任务一旦到达终态它就翻转，effect 重跑并清掉定时器、不再起新的。
   *
   * 少了这一步就会出 bug：任务 15 秒成功、轮询早已停止，但定时器仍在，120 秒后凭空
   * 置 isTimedOut，调用方于是报出一个假的「等待任务超时」。
   */
  useEffect(() => {
    setIsTimedOut(false);
    if (jobId == null || terminal) {
      return;
    }
    const timer = setTimeout(() => setIsTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [jobId, timeoutMs, terminal]);

  return {
    /** 后端返回的任务状态；`undefined` 表示尚未查到该任务（含未知 id）。 */
    status,
    /** 任务失败时后端记录的错误文本。 */
    error: task?.error ?? null,
    /** 轮询本身失败（网络/HTTP 错误），与任务失败是两件事。 */
    pollError: query.error,
    /** 仍在进行中：已触发、未到终态、也未超时。 */
    isRunning: jobId != null && !isTerminal(status) && !isTimedOut,
    isCompleted: status === "succeeded",
    isFailed: status === "failed",
    /** 超时停止：任务既未完成也未失败，但已不再轮询。 */
    isTimedOut,
  };
}
