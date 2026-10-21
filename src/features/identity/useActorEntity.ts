/**
 * 按需查询某个角色实体的完整详情（玩家与 NPC 同一端点）。
 *
 * `usePlayerActor` 只解析玩家角色名，不保证带着完整组件；角色信息浮窗需要 Identity / Appearance /
 * CharacterStats / WornCostume，所以打开浮窗时按名字拉一次 details。
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
