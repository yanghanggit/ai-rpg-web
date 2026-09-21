/**
 * 开场房间的三个动作：初始化、生成奖励（Spoils）、领卡（全部是**任务接口**）。
 *
 * 三步走的「等待 + 失效」由 `src/api/useJobAction.ts` 统一负责，这里只提供三个请求与
 * 共同的失效口径：副本状态（`/room` 的 `initialized`、`/state`）+ 实体（牌组 / 奖励）
 * + 叙事（三个动作都会产出叙事与提示消息）。
 *
 * 合成一个 hook 而不是三个，是因为三者共用**同一条后端管道与同一把玩家锁**：
 * 界面上一次只应放行一个动作，所以 `isBusy` 必须合起来看。
 *
 * 后端把「领取奖励」拆成 umbrella（`PickSpoilsAction`）与子操作（`pick_card`），
 * 接口路径 `pick_spoils/pick_card` 即这一分层；这里对应 `pickCard`。
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
