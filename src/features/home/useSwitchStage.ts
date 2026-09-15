/**
 * 家园「切换场景」：触发一次场景切换 → 等待任务 → 刷新家园状态。
 *
 * `POST /api/home/player/switch_stage/v1/` 只返回 `job_id`，真正的场景迁移
 * （以及随之而来的一轮 home pipeline）都发生在任务里；等待与失效交给
 * `src/api/useJobAction.ts`（见 docs/api-layer.md 六）。
 *
 * `switchingStage` 记录本次目标场景，页面上只把被点的那张卡显示为「切换中…」。
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
