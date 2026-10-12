/**
 * 拉取「实体名 → `creation_order`」：用 `group?all_of=IdentityComponent` 一次取回所有实体。
 *
 * 顺序在实体诞生时定死，推进 / 切场景都不变；旧缓存里新实体只是读不到而沉底。查询挂在 group
 * 路径下，实体级失效会顺带刷新。
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
