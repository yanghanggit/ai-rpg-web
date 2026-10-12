/**
 * 进入下一间（`POST .../advance_stage/v1/`）：**同步接口**，没有 job_id。
 *
 * 前置条件由后端把关（没有下一间 → 409 等），客户端不预判。成功后用 `refetchDungeons` 等重取落地
 * 再放开：这是唯一"提交完马上换屏"的副本动作，不等会先渲染缓存里的上一间。
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
      // 先等副本三条查询重取落地，再放开给调用方换屏
      await refetchDungeons(queryClient);
      // 后端在推进时就地追加叙事，不等 3s 轮询
      invalidateEntitiesAndMessages(queryClient);
    },
  });
}
