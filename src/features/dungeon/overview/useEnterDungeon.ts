/**
 * 进入副本（`POST .../enter_dungeon/v1/`）：**同步**接口，没有 job_id。
 *
 * 成功后玩家场景与队伍标记都变了、并追加传送叙事，所以失效 `invalidateHomeState` +
 * `invalidateDungeons`。返回原生 mutation，调用方用 `mutate(name, { onSuccess })` 接跳转。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { invalidateHomeState } from "../../home/invalidateHomeState";
import { clearEndedRooms } from "../endedRooms";
import { invalidateDungeons } from "../invalidateDungeons";

export function useEnterDungeon(userName: string, gameName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dungeonName: string) =>
      unwrap(
        await client.POST("/api/home/enter_dungeon/v1/", {
          body: { user_name: userName, game_name: gameName, dungeon_name: dungeonName },
        }),
      ),
    onSuccess: () => {
      // 新一局开始：上一局记下的「本间已结束」要清掉，否则同名关卡（第 1 间总是同一间）开局就被跳过
      clearEndedRooms();
      invalidateHomeState(queryClient, userName, gameName);
      invalidateDungeons(queryClient);
    },
  });
}
