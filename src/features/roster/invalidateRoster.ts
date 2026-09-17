/**
 * 队伍名单相关查询的失效口径。
 *
 * 名单（`PartyRosterComponent`）与候选（`NPCComponent`）都走 entities 的 group 端点，
 * add / remove 会改写玩家实体，所以成功后按**路径前缀**失效该端点即可命中全部参数组合。
 */
import type { QueryClient } from "@tanstack/react-query";

const ENTITY_GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

export function invalidateRoster(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["get", ENTITY_GROUP_PATH] });
}
