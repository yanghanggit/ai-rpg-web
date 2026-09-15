/**
 * 开场房间的三个动作：初始化、生成卡池、挑卡（全部是**任务接口**）。
 *
 * 三步走的「等待 + 失效」由 `src/api/useJobAction.ts` 统一负责，这里只提供三个请求与
 * 共同的失效口径：副本状态（`/room` 的 `initialized`、`/state`）+ 实体（牌组 / 卡池）
 * + 叙事（三个动作都会产出叙事与提示消息）。
 *
 * 合成一个 hook 而不是三个，是因为三者共用**同一条后端管道与同一把玩家锁**：
 * 界面上一次只应放行一个动作，所以 `isBusy` 必须合起来看。
 */
import type { QueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../api/client";
import { useJobAction } from "../../api/useJobAction";
import { invalidateEntitiesAndMessages } from "../entities/invalidateEntities";
import { invalidateDungeons } from "./invalidateDungeons";

export function useOpeningActions(userName: string, gameName: string) {
  const body = { user_name: userName, game_name: gameName };
  const onCompleted = (queryClient: QueryClient) => {
    invalidateDungeons(queryClient);
    invalidateEntitiesAndMessages(queryClient);
  };

  const init = useJobAction({
    request: async () => unwrap(await client.POST("/api/dungeon/opening/init/v1/", { body })),
    onCompleted,
  });

  const pool = useJobAction({
    request: async () =>
      unwrap(await client.POST("/api/dungeon/opening/generate_card_pool/v1/", { body })),
    onCompleted,
  });

  const pick = useJobAction({
    request: async ({ actor, card }: { actor: string; card: string }) =>
      unwrap(
        await client.POST("/api/dungeon/opening/pick_card_from_pool/v1/", {
          body: { ...body, actor_name: actor, card_name: card },
        }),
      ),
    onCompleted,
  });

  return {
    init: {
      start: () => init.start(),
      isBusy: init.isStarting || init.isRunning,
      error: init.error,
    },
    pool: {
      start: () => pool.start(),
      isBusy: pool.isStarting || pool.isRunning,
      error: pool.error,
    },
    pick: {
      start: (actor: string, card: string) => pick.start({ actor, card }),
      isBusy: pick.isStarting || pick.isRunning,
      error: pick.error,
    },
    /** 任一动作在跑：三者共用后端同一条管道，界面一次只放一个。 */
    isBusy:
      init.isStarting ||
      init.isRunning ||
      pool.isStarting ||
      pool.isRunning ||
      pick.isStarting ||
      pick.isRunning,
  };
}
