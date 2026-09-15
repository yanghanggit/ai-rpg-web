/**
 * 家园「推进」：触发一轮推进 → 等待任务 → 刷新家园状态。
 *
 * `POST /api/home/advance/v1/` 只返回 `job_id`，真正的状态变化发生在任务里，
 * 所以**拿到 job_id 不等于操作完成**——三步里的后两步由 `src/api/useJobAction.ts` 统一负责
 * （见 docs/api-layer.md 六）。
 */
import { client, unwrap } from "../../api/client";
import { useJobAction } from "../../api/useJobAction";
import { invalidateHomeState } from "./invalidateHomeState";

export function useHomeAdvance(userName: string, gameName: string, actors: readonly string[]) {
  const job = useJobAction({
    request: async () =>
      unwrap(
        await client.POST("/api/home/advance/v1/", {
          body: { user_name: userName, game_name: gameName, actors: [...actors] },
        }),
      ),
    // 家园状态与叙事一起刷新（口径见 invalidateHomeState）。
    onCompleted: (queryClient) => invalidateHomeState(queryClient, userName, gameName),
  });

  // 这个动作没有参数，对外就不该带参数（`(v: void) => void` 挂不到 onClick 上）
  return { ...job, start: () => job.start() };
}
