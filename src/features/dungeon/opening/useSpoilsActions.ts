/**
 * 奖励（Spoils）动作：生成候选 / 领卡。**与房间类型无关**：服务端按「当前是非战斗房间」判定，
 * 客户端目前只有开场房这一个使用者。
 *
 * 生成与领卡共用后端同一条管道与同一把玩家锁，`isBusy` 合起来看；等待与失效交给 `useJobAction`。
 * **只允许一个实例**：由页面持有，再把返回对象传给正文。
 */
import type { QueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { useJobAction } from "../../../api/useJobAction";
import { invalidateEntitiesAndMessages } from "../../entities/invalidateEntities";
import { invalidateDungeons } from "../invalidateDungeons";

export type SpoilsActions = ReturnType<typeof useSpoilsActions>;

export function useSpoilsActions(userName: string, gameName: string) {
  const body = { user_name: userName, game_name: gameName };
  const onCompleted = (queryClient: QueryClient) => {
    invalidateDungeons(queryClient);
    invalidateEntitiesAndMessages(queryClient);
  };

  const spoils = useJobAction({
    request: async () => unwrap(await client.POST("/api/dungeon/spoils/generate/v1/", { body })),
    onCompleted,
  });

  const pickCard = useJobAction({
    request: async ({ actor, card }: { actor: string; card: string }) =>
      unwrap(
        await client.POST("/api/dungeon/spoils/pick_card/v1/", {
          body: { ...body, actor_name: actor, card_name: card },
        }),
      ),
    onCompleted,
  });

  return {
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
    /** 任一奖励动作在跑：两者共用后端同一条管道，界面一次只放一个。 */
    isBusy: spoils.isStarting || spoils.isRunning || pickCard.isStarting || pickCard.isRunning,
  };
}
