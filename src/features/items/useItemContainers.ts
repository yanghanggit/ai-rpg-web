/**
 * 道具管理浮窗的取数编排：把「背包 / 储物箱 / 穿戴中时装」拼成一个视图模型。
 *
 * 涉及三个接口，存在先后依赖，所以按「跨接口编排抽 hook」的约定收在这里：
 * 1. 用 group(`WorldComponent` + `StorageComponent`) 找到储物箱世界实体（运行时才知道名字）；
 * 2. 用 group(`WornCostumeComponent`) 拿到穿戴中时装（含穿戴者）；
 * 3. 用 details 一次性拉玩家与储物箱实体，读出 `InventoryComponent` / `StorageComponent`。
 *
 * 仅在浮窗打开（`actorName` 非空）时才请求，避免家园页常驻拉取道具。
 */
import { $api } from "../../api/query";
import { readItems } from "./readItems";
import { readWornCostumes } from "./readWornCostumes";
import type { Item, WornCostume } from "./types";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";
const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

/** 储物箱是唯一同时带 WorldComponent 与 StorageComponent 的世界实体。 */
const STORAGE_MATCH = ["WorldComponent", "StorageComponent"];

export function useItemContainers(userName: string, gameName: string, actorName: string | null) {
  const path = { user_name: userName, game_name: gameName };
  const enabled = actorName !== null;

  // 储物箱实体名要运行时解析，后续 details 才能按名字批量拉取
  const storageEntity = $api.useQuery(
    "get",
    GROUP_PATH,
    { params: { path, query: { all_of: STORAGE_MATCH } } },
    { enabled, select: (data) => data.entities[0]?.name ?? null },
  );

  const wornGroup = $api.useQuery(
    "get",
    GROUP_PATH,
    { params: { path, query: { all_of: ["WornCostumeComponent"] } } },
    { enabled },
  );

  const storageName = storageEntity.data ?? null;

  const details = $api.useQuery(
    "get",
    DETAILS_PATH,
    { params: { path, query: { entities: [actorName ?? "", storageName ?? ""] } } },
    { enabled: enabled && storageName !== null },
  );

  const components = details.data?.entities.flatMap((entity) => entity.components) ?? [];
  const inventory: Item[] = readItems(components, "InventoryComponent");
  const storage: Item[] = readItems(components, "StorageComponent");
  const worn: WornCostume[] = readWornCostumes(wornGroup.data?.entities ?? []);

  return {
    inventory,
    storage,
    worn,
    isPending: storageEntity.isPending || wornGroup.isPending || details.isPending,
    isSuccess: storageEntity.isSuccess && wornGroup.isSuccess && details.isSuccess,
    isError: storageEntity.isError || wornGroup.isError || details.isError,
    error: storageEntity.error ?? wornGroup.error ?? details.error ?? null,
  };
}
