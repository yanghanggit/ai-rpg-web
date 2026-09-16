/**
 * 进入下一关（`POST /api/dungeon/progress/advance_stage/v1/`）。
 *
 * **同步接口**：后端就地推进副本（换房间 + 场景迁移 + 追加叙事），没有 job_id，
 * 所以走 `useEnterDungeon` 那条线，不用 `useJobAction`。成功后失效副本相关查询
 * （房间与状态都变了）与实体查询（队伍被搬到新房间）。
 *
 * 后端的前置条件由它自己把关（开场房间不需要已初始化、战斗房间必须战斗已结束，
 * 没有下一间则 409「副本已全部通关」），客户端不提前判断，错误原样显示。
 *
 * 返回原生 mutation：调用方用 `mutate(undefined, { onSuccess })` 接自己的后续动作。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../api/client";
import { invalidateEntitiesAndMessages } from "../entities/invalidateEntities";
import { invalidateDungeons } from "./invalidateDungeons";

export function useAdvanceStage(userName: string, gameName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/dungeon/progress/advance_stage/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    onSuccess: () => {
      invalidateDungeons(queryClient);
      // 后端在推进时就地追加叙事，所以口径与开场三个动作一致：不等 3s 轮询
      invalidateEntitiesAndMessages(queryClient);
    },
  });
}
