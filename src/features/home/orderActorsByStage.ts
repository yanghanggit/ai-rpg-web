/**
 * 按 `creation_order` 重排 `actors_by_stage`（后端返回的顺序源自集合迭代，**不保证稳定**）。
 *
 * 场景之间、场景内角色都按升序，读不到顺序的沉底并保序。只用于**展示**：推进请求里的角色顺序
 * 仍走原始映射，本函数不改变传参。
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
