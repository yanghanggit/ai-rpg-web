/**
 * 拉取「实体名 → creation_order」，供前端把展示顺序钉死。
 *
 * 后端 `StagesStateResponse.actors_by_stage` 只给名字、不给顺序（见 `creationOrder.ts`
 * 的文件头说明），所以这里用 `group?all_of=IdentityComponent` 一次性取回所有实体，
 * 读它们的 `IdentityComponent.creation_order`。Identity 挂在每个世界 / 场景 / 角色实体上，
 * 所以这一条查询就能覆盖家园页要排序的全部对象。
 *
 * 顺序是**实体诞生时定死的**，之后推进 / 切换场景都不会变；只有新实体（新场景 / 新角色）
 * 才会出现，且序号严格更大（后端 `entity_counter` 只增不减）。所以即使这条查询还在用旧缓存，
 * 新实体也只是「读不到顺序」而按 `sortByCreationOrder` 沉底——正好符合它应有的位置。
 * 查询本身挂在 group 路径下，实体级失效（`invalidateEntities`）会顺带刷新它，无需另加口径。
 */
import { useMemo } from "react";
import { $api } from "../../api/query";
import { COMPONENT } from "./componentNames";
import { type CreationOrder, readCreationOrder } from "./creationOrder";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

export function useCreationOrder(userName: string, gameName: string): CreationOrder {
  const query = $api.useQuery("get", GROUP_PATH, {
    params: {
      path: { user_name: userName, game_name: gameName },
      query: { all_of: [COMPONENT.Identity] },
    },
  });

  // entities 未变就复用同一个 Map，避免每次 render 都生成新引用
  const entities = query.data?.entities;
  return useMemo(() => readCreationOrder(entities ?? {}), [entities]);
}
