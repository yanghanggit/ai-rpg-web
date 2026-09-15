/**
 * 按需查询某个角色实体的完整详情。
 *
 * `usePlayerActor` 只解析出玩家角色名（且会被开局预填的缓存命中），不保证带着完整组件；
 * 「角色信息浮窗」需要 Identity / Appearance / CharacterStats / WornCostume 等组件，
 * 所以打开浮窗时用 details 端点按名字拉一次完整实体。玩家与 NPC 走同一个端点。
 */
import { $api } from "../../api/query";

const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

export function useActorEntity(userName: string, gameName: string, actorName: string | null) {
  return $api.useQuery(
    "get",
    DETAILS_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { entities: [actorName ?? ""] },
      },
    },
    { enabled: actorName !== null },
  );
}
