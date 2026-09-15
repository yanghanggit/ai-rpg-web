/**
 * 离开副本（`POST /api/dungeon/exit/v1/`）。
 *
 * **任务接口**：只返回 `job_id`，真正的退出由后端任务完成（`execute_exit_dungeon_task`）——
 * 队伍被传回家园场景、`PartyMemberComponent` 摘掉、满血恢复、死亡组件移除，
 * 最后 `teardown_dungeon` 把 `world.dungeon` 重置回空副本。
 * **「回家」发生在任务内部**，所以页面只要在终态后跳家园页——拿到 `job_id` 不等于已退出。
 *
 * 与 `useGenerateDungeon` 同一范式（触发 → 等任务 → 失效刷新）；区别是终态后要由页面跳转，
 * 所以额外给出 `isExited`。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "../../api/client";
import { describeApiError } from "../../api/describeApiError";
import { useTask } from "../../api/useTask";
import { invalidateHomeState } from "../home/invalidateHomeState";
import { invalidateDungeons } from "./invalidateDungeons";

export function useExitDungeon(userName: string, gameName: string) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const task = useTask(jobId);

  const exit = useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/dungeon/exit/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    // 这里只拿到 job_id；退出结果由下面的 useTask 负责等待
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
    // 副本这一侧：副本已被拆掉（状态回到空副本、当前房间没了）；
    // 家园这一侧：队伍成员已被传回家园场景，并追加了退出叙事。
    invalidateDungeons(queryClient);
    invalidateHomeState(queryClient, userName, gameName);
  }, [jobId, task.isCompleted, queryClient, userName, gameName]);

  // 失败有四种来源，这里统一成一条文案给页面用
  let error: string | null = null;
  if (exit.isError) {
    error = describeApiError(exit.error);
  } else if (task.isFailed) {
    error = task.error ?? "任务失败（后端未提供错误信息）";
  } else if (task.isTimedOut) {
    error = "等待任务超时，请检查服务器状态";
  } else if (task.streamError) {
    error = `监听任务状态失败：${describeApiError(task.streamError)}`;
  }

  return {
    start: () => {
      exit.reset();
      setJobId(null); // 清掉上一轮的终态，避免按钮闪回
      exit.mutate();
    },
    /** 请求已提交或任务还在跑：按钮显示「退出中…」并禁用。 */
    isBusy: exit.isPending || task.isRunning,
    /** 任务成功结束（此时玩家已经在家园了）。 */
    isExited: task.isCompleted,
    error,
  };
}
