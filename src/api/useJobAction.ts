/**
 * 「触发 → 等任务 → 失效刷新」：job 模式动作的**唯一实现**。
 *
 * 后端绝大多数动作接口（advance / switch_stage / craft / 副本的 init、生成奖励、领卡、退出……）
 * 只返回 `job_id` 而**不是**新状态，真正的状态变化发生在任务里。所以每个动作都是同样三步，
 * 且失败有四种来源（提交失败 / 任务失败 / 任务超时 / SSE 断开）。这段逻辑以前在
 * `useHomeAdvance`、`useSwitchStage`、`useCraftItem`、`useGenerateDungeon`、`useExitDungeon`
 * 里各写了一遍——现在收在这里一份，各领域只提供「怎么发请求」「完事失效什么」。
 *
 * 放在 `src/api/` 而非 `src/features/`：job 是 API 契约的一部分
 * （见 docs/conventions.md 三「与契约有关 → 下沉 api/」），这样各 feature 也无需互相依赖。
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
    // 这里只拿到 job_id；结果由下面的 useTask 负责等待
    onSuccess: (result) => setJobId(result.job_id),
  });

  // 任务进入终态后失效查询。同一个 job 只失效一次——
  // 否则 isCompleted 期间每次渲染都会再触发一轮请求。
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
      setJobId(null); // 清掉上一轮的终态，避免按钮闪回「已完成」
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
