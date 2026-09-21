/**
 * 进入下一间（`POST /api/dungeon/progress/advance_stage/v1/`）。
 *
 * **同步接口**：后端就地推进副本（换房间 + 场景迁移 + 推进叙事 + 下一间是战斗房时创建战斗实例），
 * 没有 job_id，所以走 `useEnterDungeon` 那条线，不用 `useJobAction`。
 *
 * 后端的前置条件由它自己把关（开场房不需要已初始化、战斗房必须已结算、没有下一间则 409
 * 「副本已全部通关」，战斗失败也拒），客户端不提前判断，错误原样显示。
 *
 * **成功后等重取落地再放开**（`refetchDungeons`）：推进是唯一"提交完马上就要换屏"的副本动作
 * ——地图上那颗按钮紧接着就 `navigate` 进房间页，如果不等，房间页会先渲染缓存里的**上一间**
 * 房间，闪一下错屏。`isPending` 覆盖"请求 + 重取"整段，所以按钮的「推进中…」也是完整的。
 *
 * 返回原生 mutation：调用方用 `mutate(undefined, { onSuccess })` 接自己的后续动作（换屏）。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { invalidateEntitiesAndMessages } from "../../entities/invalidateEntities";
import { refetchDungeons } from "../invalidateDungeons";

export function useAdvanceStage(userName: string, gameName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/dungeon/progress/advance_stage/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    onSuccess: async () => {
      // 先等副本三条查询重取落地（房间与状态都变了），再放开给调用方换屏
      await refetchDungeons(queryClient);
      // 后端在推进时就地追加叙事，所以口径与开场三个动作一致：不等 3s 轮询
      invalidateEntitiesAndMessages(queryClient);
    },
  });
}
