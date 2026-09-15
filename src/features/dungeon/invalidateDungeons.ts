/**
 * 副本列表的失效口径。
 *
 * 副本列表是磁盘上的静态资源（`/api/home/dungeon-list/v1/`），「生成副本」成功后
 * 会多出一份 JSON，按路径前缀失效该查询即可。
 *
 * 叙事（会话消息）不在这里失效：那条查询本身带 `refetchInterval` 轮询兜底。
 */
import type { QueryClient } from "@tanstack/react-query";

const DUNGEON_LIST_PATH = "/api/home/dungeon-list/v1/";

export function invalidateDungeons(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["get", DUNGEON_LIST_PATH] });
}
