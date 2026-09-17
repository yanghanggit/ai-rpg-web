/**
 * 战斗房间的五个改变性动作：初始化、抓牌、出牌、使用消耗品、使用装备、过牌。
 *
 * 全部是**任务接口**（只返回 `job_id`），所以「等待 + 失效」统一交给 `src/api/useJobAction.ts`。
 * 失效口径与开场的三个动作一致：副本相关查询（`/room` 的 `combat`、`/state`）+ 实体
 * （血量 / 手牌 / 牌堆 / 战利品）+ 叙事。**场景映射不需要单独失效**——参战者快照走的是
 * 队伍 group + 房间怪物名，两者都在这条口径里。
 *
 * 合成一个 hook 而不是六个，是因为它们共用后端**同一把玩家锁**：界面上一次只应放行一个动作，
 * 所以 `isBusy` 必须合起来看。
 *
 * 结算的「收取战利品」是**同步**接口（直接返回 message，没有 job），不属于这里；
 * 「进入下一关」复用 `useAdvanceStage`。
 */
import type { QueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../../api/client";
import { useJobAction } from "../../../api/useJobAction";
import { invalidateEntitiesAndMessages } from "../../entities/invalidateEntities";
import { invalidateDungeons } from "../invalidateDungeons";

export function useCombatActions(userName: string, gameName: string) {
  const body = { user_name: userName, game_name: gameName };
  const onCompleted = (queryClient: QueryClient) => {
    invalidateDungeons(queryClient);
    invalidateEntitiesAndMessages(queryClient);
  };

  const init = useJobAction({
    request: async () => unwrap(await client.POST("/api/dungeon/combat/init/v1/", { body })),
    onCompleted,
  });

  const draw = useJobAction({
    request: async () => unwrap(await client.POST("/api/dungeon/combat/draw_cards/v1/", { body })),
    onCompleted,
  });

  const play = useJobAction({
    request: async ({ actor, card, targets }: { actor: string; card: string; targets: string[] }) =>
      unwrap(
        await client.POST("/api/dungeon/combat/play_cards/v1/", {
          body: { ...body, actor_name: actor, card_name: card, targets },
        }),
      ),
    onCompleted,
  });

  const use = useJobAction({
    request: async ({ item, targets }: { item: string; targets: string[] }) =>
      unwrap(
        await client.POST("/api/dungeon/combat/use_consumable/v1/", {
          body: { ...body, item_name: item, targets },
        }),
      ),
    onCompleted,
  });

  const gear = useJobAction({
    request: async ({ item }: { item: string }) =>
      unwrap(
        await client.POST("/api/dungeon/combat/equip_gear/v1/", {
          body: { ...body, item_name: item },
        }),
      ),
    onCompleted,
  });

  const pass = useJobAction({
    request: async ({ actor }: { actor: string }) =>
      unwrap(
        await client.POST("/api/dungeon/combat/pass_turn/v1/", {
          body: { ...body, actor_name: actor },
        }),
      ),
    onCompleted,
  });

  // 怪物回合：服务端识别到 actor 是怪物后改走 MonsterPrePlaySystem 自动决策，
  // 所以 card_name / targets 只作占位（与 TUI `advance_monster_turn` 同一做法）。
  const advance = useJobAction({
    request: async ({ actor }: { actor: string }) =>
      unwrap(
        await client.POST("/api/dungeon/combat/play_cards/v1/", {
          body: { ...body, actor_name: actor, card_name: "", targets: [] },
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
    draw: {
      start: () => draw.start(),
      isBusy: draw.isStarting || draw.isRunning,
      error: draw.error,
    },
    play: {
      start: (actor: string, card: string, targets: string[]) =>
        play.start({ actor, card, targets }),
      isBusy: play.isStarting || play.isRunning,
      error: play.error,
    },
    use: {
      start: (item: string, targets: string[]) => use.start({ item, targets }),
      isBusy: use.isStarting || use.isRunning,
      error: use.error,
    },
    gear: {
      start: (item: string) => gear.start({ item }),
      isBusy: gear.isStarting || gear.isRunning,
      error: gear.error,
    },
    pass: {
      start: (actor: string) => pass.start({ actor }),
      isBusy: pass.isStarting || pass.isRunning,
      error: pass.error,
    },
    advance: {
      start: (actor: string) => advance.start({ actor }),
      isBusy: advance.isStarting || advance.isRunning,
      error: advance.error,
    },
    /** 任一动作在跑：七者共用后端同一条管道，界面一次只放一个。 */
    isBusy:
      init.isStarting ||
      init.isRunning ||
      draw.isStarting ||
      draw.isRunning ||
      play.isStarting ||
      play.isRunning ||
      use.isStarting ||
      use.isRunning ||
      gear.isStarting ||
      gear.isRunning ||
      pass.isStarting ||
      pass.isRunning ||
      advance.isStarting ||
      advance.isRunning,
  };
}

export type CombatActions = ReturnType<typeof useCombatActions>;
