/**
 * 道具相关查询的失效口径。
 *
 * 道具挂在实体上（玩家 `InventoryComponent`、世界储物箱 `StorageComponent`、
 * 角色 `WornCostumeComponent`），读取走 entities 的 details / group 两个端点。
 * 移动与合成都会改写实体，所以成功后按**路径前缀**失效这两类查询——
 * queryKey 是 `[method, path, init]`，用 `[method, path]` 前缀即可命中全部参数组合。
 */
import type { QueryClient } from "@tanstack/react-query";
import { SESSION_MESSAGES_PATH } from "../session/useSessionMessages";

const ENTITY_DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";
const ENTITY_GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

/** 失效实体详情 / 分组（背包、储物箱、穿戴中时装都从这里读）。 */
export function invalidateItems(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["get", ENTITY_DETAILS_PATH] });
  void queryClient.invalidateQueries({ queryKey: ["get", ENTITY_GROUP_PATH] });
}

/** 合成是 home pipeline 动作，产物通过会话消息通知，所以还要失效叙事。 */
export function invalidateItemsAndMessages(queryClient: QueryClient): void {
  invalidateItems(queryClient);
  void queryClient.invalidateQueries({ queryKey: ["get", SESSION_MESSAGES_PATH] });
}
