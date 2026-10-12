/**
 * 等待任务到终态：SSE `GET /api/tasks/v1/watch/{job_id}`。
 *
 * 动作接口返回 `job_id`、状态变化发生在任务里，所以「触发 → 等待 → 刷新」是通用范式。
 * 超时由服务端判定（`timeout_seconds` 透传），前端不自建定时器。
 */
import { useEffect, useState } from "react";
import { fillPath } from "./client";
import { streamSseData } from "./sse";
import type { Schemas } from "./types";

const DEFAULT_TIMEOUT_SECONDS = 120;

/** 后端任务状态（procrastinate 原始枚举）。 */
type TaskStatus = Schemas["Status"];
type TaskSnapshot = Schemas["TaskSnapshot"];

/**
 * 终态：到了就可以断开连接。只认 `succeeded` / `failed`，与后端 `/watch` 的终止条件一致。
 */
function isTerminal(status: TaskStatus | undefined): boolean {
  return status === "succeeded" || status === "failed";
}

/**
 * 正常的状态事件（`TaskSnapshot` 有 `status`）。
 *
 * 不能用「有没有 `error`」区分错误事件——`TaskSnapshot` 本身就有 `error`（失败文本，成功为 `null`）。
 */
function isTaskSnapshot(data: unknown): data is TaskSnapshot {
  return (
    typeof data === "object" && data !== null && "status" in data && typeof data.status === "string"
  );
}

/** 服务端在「任务不存在」/「超时」时推的是 `{ error, job_id }`（没有 `status`）。 */
function readErrorEvent(data: unknown): { error: string; jobId?: number } {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return { error: data.error, jobId: "job_id" in data ? Number(data.job_id) : undefined };
  }
  return { error: "unknown_event" };
}

export interface UseTaskOptions {
  /** 服务端等待上限（秒），透传给 `/watch` 的 `timeout_seconds`；默认与后端一致为 120。 */
  timeoutSeconds?: number;
}

interface TaskState {
  status: TaskStatus | undefined;
  /** 任务失败时后端记录的错误文本。 */
  error: string | null;
  /** 连接/协议错误（网络失败、任务不存在……），与「任务失败」是两件事。 */
  streamError: unknown;
  isTimedOut: boolean;
}

const INITIAL: TaskState = { status: undefined, error: null, streamError: null, isTimedOut: false };

/**
 * @param jobId 任务 ID；为 `null`/`undefined`（尚未触发）时不建立连接。
 */
export function useTask(jobId: number | null | undefined, options: UseTaskOptions = {}) {
  const { timeoutSeconds = DEFAULT_TIMEOUT_SECONDS } = options;
  const [state, setState] = useState<TaskState>(INITIAL);

  useEffect(() => {
    setState(INITIAL);
    if (jobId == null) {
      return;
    }

    const controller = new AbortController();
    let stopped = false;

    const consume = async () => {
      // 路径锚定到生成契约：`fillPath` 的模板必须是 `keyof paths`，
      // 后端改动 watch 端点时这里会在编译期失败，而不是运行时静默连错地址。
      const path = `${fillPath("/api/tasks/v1/watch/{job_id}", {
        job_id: jobId,
      })}?timeout_seconds=${timeoutSeconds}`;
      for await (const payload of streamSseData(path, { signal: controller.signal })) {
        if (stopped) {
          return;
        }
        const data: unknown = JSON.parse(payload);
        if (isTaskSnapshot(data)) {
          setState((previous) => ({ ...previous, status: data.status, error: data.error ?? null }));
          if (isTerminal(data.status)) {
            return;
          }
          continue;
        }
        const { error, jobId: errorJobId } = readErrorEvent(data);
        if (error === "timeout") {
          setState((previous) => ({ ...previous, isTimedOut: true }));
        } else {
          setState((previous) => ({
            ...previous,
            streamError: new Error(`${error}: job_id=${errorJobId ?? jobId}`),
          }));
        }
        return;
      }
      // 流正常结束却没到终态：TUI 同样按超时处理（watch_task_until_done 末尾抛 TimeoutError）
      setState((previous) =>
        isTerminal(previous.status) ? previous : { ...previous, isTimedOut: true },
      );
    };

    consume().catch((error: unknown) => {
      if (stopped || controller.signal.aborted) {
        return;
      }
      setState((previous) => ({ ...previous, streamError: error }));
    });

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [jobId, timeoutSeconds]);

  const terminal = isTerminal(state.status);

  return {
    /** 后端返回的任务状态；`undefined` 表示尚未收到状态事件。 */
    status: state.status,
    /** 任务失败时后端记录的错误文本。 */
    error: state.error,
    /** 连接/协议错误（网络失败、任务不存在……），与任务失败是两件事。 */
    streamError: state.streamError,
    /** 仍在进行中：已触发、未到终态、未超时、也未断开。 */
    isRunning: jobId != null && !terminal && !state.isTimedOut && state.streamError == null,
    isCompleted: state.status === "succeeded",
    isFailed: state.status === "failed",
    /** 超时：服务端判定超时、或流在终态前结束。 */
    isTimedOut: state.isTimedOut,
  };
}
