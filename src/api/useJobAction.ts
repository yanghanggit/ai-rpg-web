/**
 * 「触发 → 等任务 → 失效刷新」：job 模式动作的唯一实现。
 *
 * 各领域只提供「怎么发请求」`request` 与「完事失效什么」`onCompleted`；等任务（`useTask`）与四种
 * 失败来源（提交 / 任务 / 超时 / SSE）的合并都在这里。放在 `api/` 因为 job 属于契约。
 */
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { describeApiError } from "./describeApiError";
import { useTask } from "./useTask";

export interface JobActionOptions<Variables> {
  /**
   * 触发动作：发请求并返回 `job_id`。
   *
   * 只做这一件事——**不要**在里面等任务或刷新查询，那些由本 hook 负责。
   */
  request: (variables: Variables) => Promise<{ job_id: number }>;
  /** 任务进入终态后要失效哪些查询（同一个 job 只会调用一次）。 */
  onCompleted?: (queryClient: QueryClient) => void;
}

export function useJobAction<Variables = void>({
  request,
  onCompleted,
}: JobActionOptions<Variables>) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const task = useTask(jobId);

  const trigger = useMutation({
    mutationFn: request,
    // 这里只拿到 job_id，结果由 useTask 负责等待
    onSuccess: (result) => setJobId(result.job_id),
  });

  // 同一个 job 只失效一次，否则 isCompleted 期间每次渲染都会再触发一轮请求
  const invalidatedJob = useRef<number | null>(null);
  useEffect(() => {
    if (jobId === null || !task.isCompleted || invalidatedJob.current === jobId) {
      return;
    }
    invalidatedJob.current = jobId;
    onCompleted?.(queryClient);
  }, [jobId, task.isCompleted, queryClient, onCompleted]);

  // 失败有四种来源，这里统一成一条文案给页面用
  let error: string | null = null;
  if (trigger.isError) {
    error = describeApiError(trigger.error);
  } else if (task.isFailed) {
    error = task.error ?? "任务失败（后端未提供错误信息）";
  } else if (task.isTimedOut) {
    error = "等待任务超时，请检查服务器状态";
  } else if (task.streamError) {
    error = `监听任务状态失败：${describeApiError(task.streamError)}`;
  }

  return {
    start: (variables: Variables) => {
      trigger.reset();
      setJobId(null); // 清掉上一轮终态，避免按钮闪回「已完成」
      trigger.mutate(variables);
    },
    /** 正在提交请求（还没拿到 job_id）。 */
    isStarting: trigger.isPending,
    /** 任务进行中。 */
    isRunning: task.isRunning,
    /** 任务成功结束。 */
    isCompleted: task.isCompleted,
    error,
  };
}
