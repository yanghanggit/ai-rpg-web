/**
 * 生成新副本。
 *
 * 与 `useSwitchStage` / `useCraftItem` 同一范式：`POST /api/home/generate_dungeon/v1/`
 * 只返回 `job_id`，真正的生成由 home pipeline 任务完成（后端注释也写明「请通过会话消息
 * 查询结果」）。所以是「触发 → 等任务 → 失效副本列表」三步，拿到 job_id 不等于生成完成。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "../../api/client";
import { useTask } from "../../api/useTask";
import { invalidateDungeons } from "./invalidateDungeons";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useGenerateDungeon(userName: string, gameName: string) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const task = useTask(jobId);

  const generate = useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/home/generate_dungeon/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    // 这里只拿到 job_id；结果由下面的 useTask 负责等待
    onSuccess: (result) => setJobId(result.job_id),
  });

  // 任务进入终态后刷新副本列表。同一个 job 只失效一次——
  // 否则 isCompleted 期间每次渲染都会再触发一轮请求。
  const invalidatedJob = useRef<number | null>(null);
  useEffect(() => {
    if (jobId === null || !task.isCompleted || invalidatedJob.current === jobId) {
      return;
    }
    invalidatedJob.current = jobId;
    invalidateDungeons(queryClient);
  }, [jobId, task.isCompleted, queryClient]);

  // 失败有四种来源，这里统一成一条文案给页面用
  let error: string | null = null;
  if (generate.isError) {
    error = describeError(generate.error);
  } else if (task.isFailed) {
    error = task.error ?? "任务失败（后端未提供错误信息）";
  } else if (task.isTimedOut) {
    error = "等待任务超时，请检查服务器状态";
  } else if (task.streamError) {
    error = `监听任务状态失败：${describeError(task.streamError)}`;
  }

  return {
    start: () => {
      generate.reset();
      setJobId(null); // 清掉上一轮的终态，避免按钮闪回「已完成」
      generate.mutate();
    },
    /** 正在提交请求（还没拿到 job_id）。 */
    isStarting: generate.isPending,
    /** 任务进行中。 */
    isRunning: task.isRunning,
    error,
  };
}
