/**
 * 家园「切换场景」：触发场景切换 → 等任务 → 刷新家园状态。
 *
 * `POST /api/home/player/switch_stage/v1/` 只返回 `job_id`，迁移与随之而来的一轮 pipeline 都在任务里
 * （等待与失效见 `src/api/useJobAction.ts`）。`switchingStage` 记录目标场景，只给它显示「切换中…」。
 */
import { useState } from "react";
import { client, unwrap } from "../../api/client";
import { useJobAction } from "../../api/useJobAction";
import { invalidateHomeState } from "./invalidateHomeState";

export function useSwitchStage(userName: string, gameName: string) {
  const [targetStage, setTargetStage] = useState<string | null>(null);

  const job = useJobAction({
    request: async (stageName: string) =>
      unwrap(
        await client.POST("/api/home/player/switch_stage/v1/", {
          body: { user_name: userName, game_name: gameName, stage_name: stageName },
        }),
      ),
    onCompleted: (queryClient) => invalidateHomeState(queryClient, userName, gameName),
  });

  return {
    start: (stageName: string) => {
      setTargetStage(stageName);
      job.start(stageName);
    },
    isStarting: job.isStarting,
    isRunning: job.isRunning,
    /** 本次正在切换的目标场景名；空闲时为 `null`。 */
    switchingStage: job.isStarting || job.isRunning ? targetStage : null,
    error: job.error,
  };
}
