/**
 * 穿 / 脱时装。
 *
 * 与 `useSwitchStage`、`useCraftItem` 同一范式：`POST /api/home/costume/wear|remove/v1/`
 * 只返回 `job_id`，外观合成由 home pipeline 任务完成，结果通过会话消息通知。
 * 所以「触发 → 等任务 → 失效」三步，拿到 job_id 不等于换装完成。
 *
 * 两个动作共用同一条 job 监听与失效流程，所以收在一个 hook 里。
 * 穿/脱都会改动实体（外观、WornCostume）与储物箱，所以失效沿用道具那套：
 * entities details / group 前缀 + 会话消息。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "../../api/client";
import { useTask } from "../../api/useTask";
import { invalidateItemsAndMessages } from "../items/invalidateItems";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useCostumeAction(userName: string, gameName: string) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const task = useTask(jobId);

  const wear = useMutation({
    mutationFn: async ({ itemName, targetName }: { itemName: string; targetName: string }) =>
      unwrap(
        await client.POST("/api/home/costume/wear/v1/", {
          body: {
            user_name: userName,
            game_name: gameName,
            item_name: itemName,
            target_name: targetName,
          },
        }),
      ),
    onSuccess: (result) => setJobId(result.job_id),
  });

  const remove = useMutation({
    mutationFn: async (targetName: string) =>
      unwrap(
        await client.POST("/api/home/costume/remove/v1/", {
          body: { user_name: userName, game_name: gameName, target_name: targetName },
        }),
      ),
    onSuccess: (result) => setJobId(result.job_id),
  });

  // 任务进入终态后刷新实体与叙事。同一个 job 只失效一次。
  const invalidatedJob = useRef<number | null>(null);
  useEffect(() => {
    if (jobId === null || !task.isCompleted || invalidatedJob.current === jobId) {
      return;
    }
    invalidatedJob.current = jobId;
    invalidateItemsAndMessages(queryClient);
  }, [jobId, task.isCompleted, queryClient]);

  // 失败来源统一成一条文案给页面用
  let error: string | null = null;
  if (wear.isError) {
    error = describeError(wear.error);
  } else if (remove.isError) {
    error = describeError(remove.error);
  } else if (task.isFailed) {
    error = task.error ?? "任务失败（后端未提供错误信息）";
  } else if (task.isTimedOut) {
    error = "等待任务超时，请检查服务器状态";
  } else if (task.streamError) {
    error = `监听任务状态失败：${describeError(task.streamError)}`;
  }

  return {
    wear: (itemName: string, targetName: string) => {
      wear.reset();
      remove.reset();
      setJobId(null);
      wear.mutate({ itemName, targetName });
    },
    remove: (targetName: string) => {
      wear.reset();
      remove.reset();
      setJobId(null);
      remove.mutate(targetName);
    },
    isStarting: wear.isPending || remove.isPending,
    isRunning: task.isRunning,
    error,
  };
}
