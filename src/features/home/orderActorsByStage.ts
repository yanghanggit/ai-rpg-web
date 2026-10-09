/**
 * 按 `creation_order` 重排 `actors_by_stage`，供家园页展示。
 *
 * 后端返回的场景 key 顺序与场景内角色顺序都源自集合迭代，**不保证稳定**（见
 * `features/entities/creationOrder.ts`）。这个纯函数把它们按创建顺序钉死：
 * 场景之间、同一场景内的角色都按 `creation_order` 升序，读不到顺序的沉底并保序。
 *
 * 只用于**展示**：推进请求里的角色顺序（`collectActors`）仍走原始映射，本函数不改变
 * 传参，调用方按需取用返回值。
 */
import type { Schemas } from "../../api/types";
import { type CreationOrder, sortByCreationOrder } from "../entities/creationOrder";

export function orderActorsByStage(
  actorsByStage: Schemas["StagesStateResponse"]["actors_by_stage"],
  order: CreationOrder,
): Schemas["StagesStateResponse"]["actors_by_stage"] {
  const ordered: Schemas["StagesStateResponse"]["actors_by_stage"] = {};
  for (const stage of sortByCreationOrder(Object.keys(actorsByStage), order)) {
    ordered[stage] = sortByCreationOrder(actorsByStage[stage] ?? [], order);
  }
  return ordered;
}
