/**
 * 开场初始化动作：`opening-init`（叙事 + 环境）。**仅开场房间使用**。
 *
 * 管道内部按消息标记幂等，可重复调用。**只允许一个实例**：由非战斗房页面持有，只在开场房间下发起。
 */
import type { QueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { useJobAction } from "../../../api/useJobAction";
import { invalidateEntitiesAndMessages } from "../../entities/invalidateEntities";
import { invalidateDungeons } from "../invalidateDungeons";

export type OpeningInit = ReturnType<typeof useOpeningInit>;

export function useOpeningInit(userName: string, gameName: string) {
  const body = { user_name: userName, game_name: gameName };
  const onCompleted = (queryClient: QueryClient) => {
    invalidateDungeons(queryClient);
    invalidateEntitiesAndMessages(queryClient);
  };

  const init = useJobAction({
    request: async () => unwrap(await client.POST("/api/dungeon/opening/init/v1/", { body })),
    onCompleted,
  });

  return {
    start: () => init.start(),
    isBusy: init.isStarting || init.isRunning,
    error: init.error,
  };
}
