/**
 * 离开副本（`POST /api/dungeon/exit/v1/`）。
 *
 * **任务接口**：只返回 `job_id`，真正的退出由后端任务完成（`execute_exit_dungeon_task`）——
 * 队伍被传回家园场景、`PartyMemberComponent` 摘掉、满血恢复、死亡组件移除，
 * 最后 `teardown_dungeon` 把 `world.dungeon` 重置回空副本。
 * **「回家」发生在任务内部**，所以页面只要在终态后跳家园页——拿到 `job_id` 不等于已退出。
 *
 * 等待与失效交给 `src/api/useJobAction.ts`（见 docs/api-layer.md 六）；
 * 终态后要由页面跳转，所以额外给出 `isExited`。
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
      // 副本这一侧：副本已被拆掉（状态回到空副本、当前房间没了）；
      // 家园这一侧：队伍成员已被传回家园场景，并追加了退出叙事。
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

/** 这个 hook 的形状（页面持有它、传给 `RoomScaffold`，顺便也给房间的结束动作调 `start`）。 */
export type ExitDungeon = ReturnType<typeof useExitDungeon>;
