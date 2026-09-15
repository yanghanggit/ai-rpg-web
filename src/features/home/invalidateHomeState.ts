/**
 * 家园「动作任务」完成后统一要失效的查询。
 *
 * `advance` 与 `switch_stage` 都会触发 home pipeline：既可能改变场景状态
 * （角色位置 / 玩家所在场景），也会产生新的会话消息（叙事）。两类动作的刷新口径
 * 必须一致，所以集中在这里——以后新增家园动作时不会各写一份、漏掉某一处。
 */
import type { QueryClient } from "@tanstack/react-query";
import { $api } from "../../api/query";
import { SESSION_MESSAGES_PATH } from "../session/useSessionMessages";

export function invalidateHomeState(
  queryClient: QueryClient,
  userName: string,
  gameName: string,
): void {
  void queryClient.invalidateQueries(
    $api.queryOptions("get", "/api/stages/v1/{user_name}/{game_name}/state", {
      params: { path: { user_name: userName, game_name: gameName } },
    }),
  );

  // 会话消息的游标在 queryKey 里，所以用前缀匹配整个「会话消息」资源。
  void queryClient.invalidateQueries({ queryKey: ["get", SESSION_MESSAGES_PATH] });
}
