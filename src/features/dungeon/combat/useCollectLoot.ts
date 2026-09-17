/**
 * 收取战利品（`POST /api/dungeon/combat/collect_loot/v1/`）。
 *
 * **同步接口**：后端就地发起把玩家身上的 `LootComponent` 转入 `InventoryComponent`，
 * 直接返回 `message`，没有 `job_id`，所以不走 `useJobAction`（与 `useAdvanceStage` 同一手法）。
 *
 * 成功后失效**实体 + 叙事**：战利品从玩家身上消失、进入背包；副本房间与进度都没变，
 * 所以不失效 dungeons。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { invalidateEntitiesAndMessages } from "../../entities/invalidateEntities";

export function useCollectLoot(userName: string, gameName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/dungeon/combat/collect_loot/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    onSuccess: () => invalidateEntitiesAndMessages(queryClient),
  });
}
