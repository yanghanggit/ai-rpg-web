/**
 * 工坊合成（消耗品 / 装备 / 时装）。
 *
 * 与 `useSwitchStage` 同一范式：`POST /api/home/craft/*` 只返回 `job_id`，
 * 真正的合成由 home pipeline 任务完成，结果通过会话消息通知。所以「触发 → 等任务 →
 * 失效道具 + 叙事」三步，拿到 job_id 不等于合成完成。
 *
 * 三个工坊的请求体与响应体完全一致（都是 `HomeCraftItemRequest/Response`），
 * 只是路径不同，所以合成入口用 `workshop` 参数区分。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "../../api/client";
import { useTask } from "../../api/useTask";
import { invalidateItemsAndMessages } from "./invalidateItems";

/** 三个工坊；路径里的段名即工坊名（消耗品端点已从 `item` 正名为 `consumable`）。 */
export type Workshop = "consumable" | "gear" | "costume";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useCraftItem(userName: string, gameName: string) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const task = useTask(jobId);

  const craft = useMutation({
    mutationFn: async ({ workshop, materials }: { workshop: Workshop; materials: string[] }) => {
      const body = { user_name: userName, game_name: gameName, materials };
      switch (workshop) {
        case "consumable":
          return unwrap(await client.POST("/api/home/craft/consumable/v1/", { body }));
        case "gear":
          return unwrap(await client.POST("/api/home/craft/gear/v1/", { body }));
        case "costume":
          return unwrap(await client.POST("/api/home/craft/costume/v1/", { body }));
      }
    },
    // 这里只拿到 job_id；结果由下面的 useTask 负责等待
    onSuccess: (result) => setJobId(result.job_id),
  });

  // 任务进入终态后刷新道具与叙事。同一个 job 只失效一次——
  // 否则 isCompleted 期间每次渲染都会再触发一轮请求。
  const invalidatedJob = useRef<number | null>(null);
  useEffect(() => {
    if (jobId === null || !task.isCompleted || invalidatedJob.current === jobId) {
      return;
    }
    invalidatedJob.current = jobId;
    invalidateItemsAndMessages(queryClient);
  }, [jobId, task.isCompleted, queryClient]);

  // 失败有四种来源，这里统一成一条文案给页面用
  let error: string | null = null;
  if (craft.isError) {
    error = describeError(craft.error);
  } else if (task.isFailed) {
    error = task.error ?? "任务失败（后端未提供错误信息）";
  } else if (task.isTimedOut) {
    error = "等待任务超时，请检查服务器状态";
  } else if (task.streamError) {
    error = `监听任务状态失败：${describeError(task.streamError)}`;
  }

  return {
    start: (workshop: Workshop, materials: string[]) => {
      craft.reset();
      setJobId(null); // 清掉上一轮的终态，避免按钮闪回「已完成」
      craft.mutate({ workshop, materials });
    },
    /** 正在提交请求（还没拿到 job_id）。 */
    isStarting: craft.isPending,
    /** 任务进行中。 */
    isRunning: task.isRunning,
    error,
  };
}
