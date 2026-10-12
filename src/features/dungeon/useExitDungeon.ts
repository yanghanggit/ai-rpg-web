/**
 * 离开副本（`POST /api/dungeon/exit/v1/`）：任务接口，只返回 `job_id`。真正的退出（队伍回家园、
 * 副本拆掉）在任务内部完成，所以页面在终态后跳家园页。
 */
import { client, unwrap } from "../../api/client";
import { useJobAction } from "../../api/useJobAction";
import { invalidateHomeState } from "../home/invalidateHomeState";
import { invalidateDungeons } from "./invalidateDungeons";

export function useExitDungeon(userName: string, gameName: string) {
  const job = useJobAction({
    request: async () =>
      unwrap(
        await client.POST("/api/dungeon/exit/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    onCompleted: (queryClient) => {
      // 副本已被拆掉，队伍已被送回家园
      invalidateDungeons(queryClient);
      invalidateHomeState(queryClient, userName, gameName);
    },
  });

  return {
    start: () => job.start(),
    /** 请求已提交或任务还在跑：按钮显示「退出中…」并禁用。 */
    isBusy: job.isStarting || job.isRunning,
    /** 任务成功结束（此时玩家已经在家园了）。 */
    isExited: job.isCompleted,
    error: job.error,
  };
}

/** 这个 hook 的形状（页面持有它，传给 `RoomScaffold`）。 */
export type ExitDungeon = ReturnType<typeof useExitDungeon>;
