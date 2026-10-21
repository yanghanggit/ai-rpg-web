/**
 * 背包 ↔ 储物箱互移。
 *
 * 接口是**同步**的（直接改实体返回 `message`，没有 job）：请求成功即完成，就地失效道具查询。
 * 后端按 `item_names` 逐个移动，任一不存在即整个请求 400。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../api/client";
import { describeApiError } from "../../api/describeApiError";
import { invalidateEntities } from "../entities/invalidateEntities";

export function useMoveItem(userName: string, gameName: string) {
  const queryClient = useQueryClient();

  const toInventory = useMutation({
    mutationFn: async (itemNames: string[]) =>
      unwrap(
        await client.POST("/api/home/item/move_to_inventory/v1/", {
          body: { user_name: userName, game_name: gameName, item_names: itemNames },
        }),
      ),
    onSuccess: () => invalidateEntities(queryClient),
  });

  const toStorage = useMutation({
    mutationFn: async (itemNames: string[]) =>
      unwrap(
        await client.POST("/api/home/item/move_to_storage/v1/", {
          body: { user_name: userName, game_name: gameName, item_names: itemNames },
        }),
      ),
    onSuccess: () => invalidateEntities(queryClient),
  });

  let error: string | null = null;
  if (toInventory.isError) {
    error = describeApiError(toInventory.error);
  } else if (toStorage.isError) {
    error = describeApiError(toStorage.error);
  }

  return {
    moveToInventory: (itemNames: string[]) => {
      toInventory.reset();
      toStorage.reset();
      toInventory.mutate(itemNames);
    },
    moveToStorage: (itemNames: string[]) => {
      toInventory.reset();
      toStorage.reset();
      toStorage.mutate(itemNames);
    },
    isPending: toInventory.isPending || toStorage.isPending,
    error,
  };
}
