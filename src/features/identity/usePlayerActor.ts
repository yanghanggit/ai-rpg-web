/**
 * 解析「玩家控制的角色名」（player_actor）。
 *
 * 为什么需要它：`StagesStateResponse.actors_by_stage` 只给「场景 → 角色」，
 * 要判断玩家当前在哪个场景（高亮、禁用「切换到此场景」），必须先知道玩家是谁。
 * 后端没有单独的 player_session 查询接口，但玩家实体挂了 `PlayerComponent`
 * （见 `ai-rpg` 的 `game/dbg_game.py`），可以用 group 端点精确捞出——
 * 口径与 TUI 的 `resolve_identity` + `find_stage_of_actor` 一致。
 *
 * ## 缓存
 *
 * `player_session.actor` 一旦确定就不再变化，所以这里直接用 React Query 自带的缓存
 * （`staleTime: Infinity`），不引入额外的 store / localStorage。正常流程（入口页开局）
 * 由 `useStartGame` 成功时 `seedPlayerActor` 预填，家园页无需再发请求；
 * 只有硬刷新 / 深链缺缓存时才回退到一次 group 查询。
 */
import type { QueryClient } from "@tanstack/react-query";
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

/**
 * group 端点的 init。
 *
 * 只允许这一处构造：queryKey 是 `[method, path, init]`，读写缓存两边的 init
 * 必须逐字段一致，否则 `seedPlayerActor` 会写进另一条缓存。
 */
function playerActorInit(userName: string, gameName: string) {
  return {
    params: {
      path: { user_name: userName, game_name: gameName },
      query: { all_of: ["PlayerComponent"] },
    },
  };
}

/** 读取玩家角色名；后端返回空（尚无玩家实体）时为 `null`。 */
export function usePlayerActor(userName: string, gameName: string) {
  return $api.useQuery("get", GROUP_PATH, playerActorInit(userName, gameName), {
    staleTime: Infinity,
    // group 端点按 PlayerComponent 过滤后只剩玩家实体，取第一个即可。
    select: (data) => data.entities[0]?.name ?? null,
  });
}

/**
 * 把已知的 player_actor 写入缓存。
 *
 * 用 `EntitiesDetailsResponse` 的最小合法形态填充：下游只取 `entities[0].name`，
 * `components` 留空、不参与判断。
 */
export function seedPlayerActor(
  queryClient: QueryClient,
  userName: string,
  gameName: string,
  actorName: string,
): void {
  const data: Schemas["EntitiesDetailsResponse"] = {
    entities: [{ name: actorName, components: [] }],
  };

  queryClient.setQueryData(
    $api.queryOptions("get", GROUP_PATH, playerActorInit(userName, gameName)).queryKey,
    data,
  );
}
