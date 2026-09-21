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
 *
 * **两个入口的区别只有一个：等不等重取落地。**
 * - `invalidateDungeons`：不等（默认口径，绝大多数调用方只关心"之后某次渲染会拿到新数据"）；
 * - `refetchDungeons`：等（**推进**后必须用——调用方紧接着就要换屏，否则新屏会先渲染缓存里的
 *   旧房间，闪一下错屏）。
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

/**
 * 同 `invalidateDungeons`，但**等重取落地**（返回的 promise 在所有活跃查询重取完成后 resolve）。
 *
 * 注意它只重取**活跃**查询：没有任何组件在看这几条查询时立刻 resolve，这是对的
 * ——没人看的东西不需要现在就去取。
 */
export async function refetchDungeons(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    DUNGEON_PATHS.map((path) => queryClient.invalidateQueries({ queryKey: ["get", path] })),
  );
}
