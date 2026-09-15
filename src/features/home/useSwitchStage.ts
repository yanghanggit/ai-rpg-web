/**
 * 家园「切换场景」：触发一次场景切换 → 等待任务 → 刷新家园状态。
 *
 * 与 `useHomeAdvance` 同一范式（见 docs/api-layer.md 六）：
 * `POST /api/home/player/switch_stage/v1/` 只返回 `job_id`，真正的场景迁移
 * （以及随之而来的一轮 home pipeline）都发生在任务里，拿到 job_id 不等于切换完成。
 *
 * `switchingStage` 记录本次目标场景，页面上只把被点的那张卡显示为「切换中…」。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "../../api/client";
import { useTask } from "../../api/useTask";
import { invalidateHomeState } from "./invalidateHomeState";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSwitchStage(userName: string, gameName: string) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const [targetStage, setTargetStage] = useState<string | null>(null);
  const task = useTask(jobId);

  const switchStage = useMutation({
    mutationFn: async (stageName: string) =>
      unwrap(
        await client.POST("/api/home/player/switch_stage/v1/", {
          body: { user_name: userName, game_name: gameName, stage_name: stageName },
        }),
      ),
    // 这里只拿到 job_id；结果由下面的 useTask 负责等待
    onSuccess: (result) => setJobId(result.job_id),
  });

  // 任务进入终态后刷新家园状态。同一个 job 只失效一次——
  // 否则 isCompleted 期间每次渲染都会再触发一轮请求。
  const invalidatedJob = useRef<number | null>(null);
  useEffect(() => {
    if (jobId === null || !task.isCompleted || invalidatedJob.current === jobId) {
      return;
    }
    invalidatedJob.current = jobId;
    invalidateHomeState(queryClient, userName, gameName);
  }, [jobId, task.isCompleted, queryClient, userName, gameName]);

  const isStarting = switchStage.isPending;
  const isRunning = task.isRunning;

  // 失败有四种来源，这里统一成一条文案给页面用
  let error: string | null = null;
  if (switchStage.isError) {
    error = describeError(switchStage.error);
  } else if (task.isFailed) {
    error = task.error ?? "任务失败（后端未提供错误信息）";
  } else if (task.isTimedOut) {
    error = "等待任务超时，请检查服务器状态";
  } else if (task.streamError) {
    error = `监听任务状态失败：${describeError(task.streamError)}`;
  }

  return {
    start: (stageName: string) => {
      switchStage.reset();
      setJobId(null); // 清掉上一轮的终态，避免按钮闪回「已完成」
      setTargetStage(stageName);
      switchStage.mutate(stageName);
    },
    /** 正在提交请求（还没拿到 job_id）。 */
    isStarting,
    /** 任务进行中。 */
    isRunning,
    /** 本次正在切换的目标场景名；空闲时为 `null`。 */
    switchingStage: isStarting || isRunning ? targetStage : null,
    error,
  };
}
