/**
 * 储物箱里可穿的时装。
 *
 * 穿时装的来源是全局 `StorageComponent`，从中筛出 `CostumeItem`。已经穿在身上的时装
 * 不在储物箱里（后端穿装时会把它移出），所以这份列表天然只含「可穿」的。
 * 仅在二级浮窗打开时请求。
 */
import { $api } from "../../api/query";
import { COMPONENT } from "../entities/componentNames";
import { readItems } from "../items/readItems";
import type { Item } from "../items/types";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";
const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

/** 储物箱是唯一同时带 WorldComponent 与 StorageComponent 的世界实体。 */
const STORAGE_MATCH = [COMPONENT.World, COMPONENT.Storage];

export function useStorageCostumes(userName: string, gameName: string, enabled: boolean) {
  const path = { user_name: userName, game_name: gameName };

  // 储物箱实体名要运行时解析，details 才能按名字取到它
  const storageEntity = $api.useQuery(
    "get",
    GROUP_PATH,
    { params: { path, query: { all_of: STORAGE_MATCH } } },
    { enabled, select: (data) => data.entities[0]?.name ?? null },
  );

  const storageName = storageEntity.data ?? null;

  const details = $api.useQuery(
    "get",
    DETAILS_PATH,
    { params: { path, query: { entities: [storageName ?? ""] } } },
    { enabled: enabled && storageName !== null },
  );

  const components = details.data?.entities.flatMap((entity) => entity.components) ?? [];
  const costumes: Item[] = readItems(components, COMPONENT.Storage).filter(
    (item) => item.type === "CostumeItem",
  );

  return {
    costumes,
    isPending: storageEntity.isPending || details.isPending,
    isSuccess: storageEntity.isSuccess && details.isSuccess,
    isError: storageEntity.isError || details.isError,
    error: storageEntity.error ?? details.error ?? null,
  };
}
