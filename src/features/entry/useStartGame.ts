/**
 * 玩家开局编排流程：登录 → 新游戏。
 *
 * 两个接口的顺序调用属于业务编排，按 docs/api-layer.md 第 5 条抽成 hook，
 * 不写在页面组件里。请求体类型从生成物派生，不手写。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../api/client";
import type { ApiBody } from "../../api/types";
import { seedPlayerActor } from "../identity/usePlayerActor";

/** 登录请求体；字段与 NewGameRequest 一致，故两个接口共用。 */
export type StartGameInput = ApiBody<"/api/login/v1/">;

export function useStartGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: StartGameInput) => {
      unwrap(await client.POST("/api/login/v1/", { body: input }));
      return unwrap(await client.POST("/api/game/new/v1/", { body: input }));
    },
    // player_actor 一旦确定就不再变化，开局成功即预填进缓存，
    // 家园页（usePlayerActor）无需再发一次 group 查询。
    onSuccess: (data, input) => {
      seedPlayerActor(queryClient, input.user_name, input.game_name, data.player_session.actor);
    },
  });
}
