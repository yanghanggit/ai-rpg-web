/**
 * 家园「推进」：触发一轮推进 → 等待后台任务 → 刷新家园状态。
 *
 * 这是「触发 → 等待 → 刷新」这一 API 范式的第一次完整落地（见 docs/api-layer.md 六）：
 * `POST /api/home/advance/v1/` 只返回 `job_id`，真正的状态变化发生在后台任务里，
 * 所以**拿到 job_id 不等于操作完成**，必须等任务进入终态，再刷新相关查询。
 *
 * 触发用 plain `useMutation` + `client.POST`（跨接口编排，见 api-layer.md 五），
 * 等待复用 `src/api/useTask.ts`。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "../../api/client";
import { $api } from "../../api/query";
import { useTask } from "../../api/useTask";
import { SESSION_MESSAGES_PATH } from "../session/useSessionMessages";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useHomeAdvance(userName: string, gameName: string, actors: readonly string[]) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const task = useTask(jobId);

  const advance = useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/home/advance/v1/", {
          body: { user_name: userName, game_name: gameName, actors: [...actors] },
        }),
      ),
    // 这里只拿到 job_id；结果由下面的 useTask 负责等待
    onSuccess: (result) => setJobId(result.job_id),
  });

  // 任务进入终态后刷新家园状态。同一个 job 只失效一次——
  // 否则 isCompleted 期间每次渲染都会再触发一轮请求。
  const invalidatedJob = useRef<string | null>(null);
  useEffect(() => {
    if (jobId === null || !task.isCompleted || invalidatedJob.current === jobId) {
      return;
    }
    invalidatedJob.current = jobId;
    void queryClient.invalidateQueries(
      $api.queryOptions("get", "/api/stages/v1/{user_name}/{game_name}/state", {
        params: { path: { user_name: userName, game_name: gameName } },
      }),
    );
    // 推进会产生新的会话消息（NPC 行动），一并刷新，叙事面板立刻就能看到。
    // 游标在 queryKey 里，所以这里用前缀匹配整个「会话消息」资源。
    void queryClient.invalidateQueries({ queryKey: ["get", SESSION_MESSAGES_PATH] });
  }, [jobId, task.isCompleted, queryClient, userName, gameName]);

  // 失败有四种来源，这里统一成一条文案给页面用
  let error: string | null = null;
  if (advance.isError) {
    error = describeError(advance.error);
  } else if (task.isFailed) {
    error = task.error ?? "后台任务失败（后端未提供错误信息）";
  } else if (task.isTimedOut) {
    error = "等待后台任务超时，请检查服务器状态";
  } else if (task.pollError) {
    error = `轮询任务状态失败：${describeError(task.pollError)}`;
  }

  return {
    start: () => {
      advance.reset();
      setJobId(null); // 清掉上一轮的终态，避免按钮闪回「已完成」
      advance.mutate();
    },
    /** 正在提交请求（还没拿到 job_id）。 */
    isStarting: advance.isPending,
    /** 后台任务进行中。 */
    isRunning: task.isRunning,
    /** 本轮推进已完成。 */
    isCompleted: task.isCompleted,
    error,
  };
}
