/**
 * 解析「玩家控制的角色名」（`player_actor`）：用 group 端点按 `PlayerComponent` 过滤。
 *
 * `player_session.actor` 一旦确定就不再变，所以用 `staleTime: Infinity`；正常开局由
 * `useStartGame` 预填缓存，只有硬刷新 / 深链才回退到查询。
 */
import type { QueryClient } from "@tanstack/react-query";
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";
import { COMPONENT } from "../entities/componentNames";
import { firstEntity } from "../entities/ecs";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

/**
 * group 端点的 init。只允许这一处构造：queryKey 含 init，读写缓存的 init 必须逐字段一致。
 */
function playerActorInit(userName: string, gameName: string) {
  return {
    params: {
      path: { user_name: userName, game_name: gameName },
      query: { all_of: [COMPONENT.Player] },
    },
  };
}

/** 读取玩家角色名；后端返回空（尚无玩家实体）时为 `null`。 */
export function usePlayerActor(userName: string, gameName: string) {
  return $api.useQuery("get", GROUP_PATH, playerActorInit(userName, gameName), {
    staleTime: Infinity,
    // group 端点按 PlayerComponent 过滤后只剩玩家实体，取第一个即可。
    select: (data) => firstEntity(data.entities)?.name ?? null,
  });
}

/**
 * 把已知的 player_actor 写入缓存：用最小合法响应填充，下游只取第一个实体的名字。
 */
export function seedPlayerActor(
  queryClient: QueryClient,
  userName: string,
  gameName: string,
  actorName: string,
): void {
  const data: Schemas["EntitiesDetailsResponse"] = {
    entities: { [actorName]: {} },
  };

  queryClient.setQueryData(
    $api.queryOptions("get", GROUP_PATH, playerActorInit(userName, gameName)).queryKey,
    data,
  );
}
