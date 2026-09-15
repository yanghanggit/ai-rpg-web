/**
 * 副本相关查询的失效口径。
 *
 * - 副本列表（`/api/home/dungeon-list/v1/`）：磁盘上的静态资源，「生成副本」后会多出一份 JSON；
 * - 副本运行状态（`/api/dungeons/v1/{user}/{game}/state`）：「进入副本」会把它从「无副本」
 *   变成「进行中」，退出副本再变回去；
 * - 当前副本房间（`/api/dungeons/v1/{user}/{game}/room`）：进入 / 推进 / 退出都会换掉它，
 *   退出后这个接口直接 404。
 *
 * 三者都按**路径前缀**失效（queryKey 是 `[method, path, params]`，前缀匹配能覆盖所有参数组合）。
 * 叙事（会话消息）不在这里失效：那条查询本身带 `refetchInterval` 轮询兜底。
 */
import type { QueryClient } from "@tanstack/react-query";

const DUNGEON_LIST_PATH = "/api/home/dungeon-list/v1/";
const DUNGEON_STATE_PATH = "/api/dungeons/v1/{user_name}/{game_name}/state";
const DUNGEON_ROOM_PATH = "/api/dungeons/v1/{user_name}/{game_name}/room";

export function invalidateDungeons(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["get", DUNGEON_LIST_PATH] });
  void queryClient.invalidateQueries({ queryKey: ["get", DUNGEON_STATE_PATH] });
  void queryClient.invalidateQueries({ queryKey: ["get", DUNGEON_ROOM_PATH] });
}
