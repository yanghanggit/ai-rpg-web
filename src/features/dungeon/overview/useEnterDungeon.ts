/**
 * 进入副本（`POST /api/home/enter_dungeon/v1/`）。
 *
 * **同步**接口：后端就地完成「创建副本实体 → 组建队伍 → 传送到第一关」并返回 `message`，
 * 没有 job_id，所以走 `useMoveItem` / `useRosterAction` 那条线，不用 `useTask`。
 *
 * 成功后世界状态变了两处：玩家的场景（传送到副本第一关）与队伍标记
 * （玩家与名单成员都被挂上 `PartyMemberComponent`），另外会追加一条传送叙事，
 * 所以失效口径用 `invalidateHomeState`（场景 + 叙事）+ `invalidateDungeons`（副本状态）。
 *
 * 返回的是原生 mutation：调用方（页面）用 `mutate(name, { onSuccess })` 接自己的后续动作
 * （跳转到副本房间页），与 `lobby/useStartGame` 的用法一致。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { invalidateHomeState } from "../../home/invalidateHomeState";
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
      invalidateHomeState(queryClient, userName, gameName);
      invalidateDungeons(queryClient);
    },
  });
}
