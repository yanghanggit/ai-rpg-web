/**
 * 队伍名单的增删。
 *
 * `/api/home/roster/add|remove/v1/` 是**同步**接口（直接改实体返回 `message`，没有 job），
 * 所以和道具移动一样：请求成功即完成，就地失效名单查询即可，不走 `useTask` 那条线。
 * 两个接口都要求玩家在家园场景、成员是 NPC，否则返回 400——错误直接冒泡给页面。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "../../api/client";
import { describeApiError } from "../../api/describeApiError";
import { invalidateRoster } from "./invalidateRoster";

export function useRosterAction(userName: string, gameName: string) {
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: async (memberName: string) =>
      unwrap(
        await client.POST("/api/home/roster/add/v1/", {
          body: { user_name: userName, game_name: gameName, member_name: memberName },
        }),
      ),
    onSuccess: () => invalidateRoster(queryClient),
  });

  const remove = useMutation({
    mutationFn: async (memberName: string) =>
      unwrap(
        await client.POST("/api/home/roster/remove/v1/", {
          body: { user_name: userName, game_name: gameName, member_name: memberName },
        }),
      ),
    onSuccess: () => invalidateRoster(queryClient),
  });

  // 两个动作共用一个错误位：新一轮操作前先清掉上一轮的结果，避免旧错误残留
  let error: string | null = null;
  if (add.isError) {
    error = describeApiError(add.error);
  } else if (remove.isError) {
    error = describeApiError(remove.error);
  }

  return {
    add: (memberName: string) => {
      add.reset();
      remove.reset();
      add.mutate(memberName);
    },
    remove: (memberName: string) => {
      add.reset();
      remove.reset();
      remove.mutate(memberName);
    },
    isPending: add.isPending || remove.isPending,
    error,
  };
}
