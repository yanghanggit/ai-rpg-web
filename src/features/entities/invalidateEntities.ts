/**
 * 实体查询的失效口径：`details` / `group` 两个端点。
 *
 * 大量领域的状态都挂在实体组件上，所以组件被改写后要失效的是这两个路径，与「哪个领域改的」无关：
 * 按路径前缀失效即可（queryKey 是 `[method, path, init]`）。
 */
import type { QueryClient } from "@tanstack/react-query";
import { SESSION_MESSAGES_PATH } from "../session/useSessionMessages";

const ENTITY_DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";
const ENTITY_GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

/** 失效实体详情 / 分组。 */
export function invalidateEntities(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["get", ENTITY_DETAILS_PATH] });
  void queryClient.invalidateQueries({ queryKey: ["get", ENTITY_GROUP_PATH] });
}

/** 同上，外加叙事——任务型动作的结果通过会话消息通知，不能等下一次轮询。 */
export function invalidateEntitiesAndMessages(queryClient: QueryClient): void {
  invalidateEntities(queryClient);
  void queryClient.invalidateQueries({ queryKey: ["get", SESSION_MESSAGES_PATH] });
}
