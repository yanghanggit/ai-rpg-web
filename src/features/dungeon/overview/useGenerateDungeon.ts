/**
 * 生成新副本：`POST /api/home/generate_dungeon/v1/` 只返回 `job_id`，生成在 home pipeline 任务里完成
 * （等待与失效见 `src/api/useJobAction.ts`）。
 */
import { client, unwrap } from "../../../api/client";
import { useJobAction } from "../../../api/useJobAction";
import { invalidateDungeons } from "../invalidateDungeons";

export function useGenerateDungeon(userName: string, gameName: string) {
  const job = useJobAction({
    request: async () =>
      unwrap(
        await client.POST("/api/home/generate_dungeon/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    // 生成只多出一份磁盘 JSON，副本状态不受影响
    onCompleted: invalidateDungeons,
  });

  // 这个动作没有参数，对外就不该带参数（`(v: void) => void` 挂不到 onClick 上）
  return { ...job, start: () => job.start() };
}
