export type OpeningActions = ReturnType<typeof useOpeningActions>;

/**
 * 开场房间的三个动作：初始化、生成奖励、领卡（都是任务接口）。
 *
 * 合成一个 hook 是因为三者共用后端同一条管道与同一把玩家锁，`isBusy` 必须合起来看。
 * **只允许一个实例**：由页面持有，再把返回对象传给正文。等待与失效交给 `useJobAction`。
 */
import type { QueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { useJobAction } from "../../../api/useJobAction";
import { invalidateEntitiesAndMessages } from "../../entities/invalidateEntities";
import { invalidateDungeons } from "../invalidateDungeons";

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

  const spoils = useJobAction({
    request: async () =>
      unwrap(await client.POST("/api/dungeon/opening/generate_spoils/v1/", { body })),
    onCompleted,
  });

  const pickCard = useJobAction({
    request: async ({ actor, card }: { actor: string; card: string }) =>
      unwrap(
        await client.POST("/api/dungeon/opening/pick_spoils/pick_card/v1/", {
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
    spoils: {
      start: () => spoils.start(),
      isBusy: spoils.isStarting || spoils.isRunning,
      error: spoils.error,
    },
    pickCard: {
      start: (actor: string, card: string) => pickCard.start({ actor, card }),
      isBusy: pickCard.isStarting || pickCard.isRunning,
      error: pickCard.error,
    },
    /** 任一动作在跑：三者共用后端同一条管道，界面一次只放一个。 */
    isBusy:
      init.isStarting ||
      init.isRunning ||
      spoils.isStarting ||
      spoils.isRunning ||
      pickCard.isStarting ||
      pickCard.isRunning,
  };
}
