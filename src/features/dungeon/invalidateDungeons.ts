/**
 * 副本相关查询的失效口径：副本列表 / 运行状态 / 当前房间按路径前缀失效（叙事不在这里，靠 `refetchInterval`）。
 *
 * 两个入口只差「等不等重取落地」：`refetchDungeons` 会等（推进后马上换屏，不等就会先渲染旧房间）。
 */
import type { QueryClient } from "@tanstack/react-query";

const DUNGEON_LIST_PATH = "/api/home/dungeon-list/v1/";
const DUNGEON_STATE_PATH = "/api/dungeons/v1/{user_name}/{game_name}/state";
const DUNGEON_ROOM_PATH = "/api/dungeons/v1/{user_name}/{game_name}/room";

const DUNGEON_PATHS = [DUNGEON_LIST_PATH, DUNGEON_STATE_PATH, DUNGEON_ROOM_PATH];

/** 三条副本查询全部失效；**不等**重取（提交后继续走自己的流程时用）。 */
export function invalidateDungeons(queryClient: QueryClient): void {
  void refetchDungeons(queryClient);
}

/** 同上，但等重取落地；只重取活跃查询（没人看时立刻 resolve）。 */
export async function refetchDungeons(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    DUNGEON_PATHS.map((path) => queryClient.invalidateQueries({ queryKey: ["get", path] })),
  );
}
