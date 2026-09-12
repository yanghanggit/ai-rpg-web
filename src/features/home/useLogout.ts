import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { client, unwrap } from "../../api/client";

/**
 * 登出并回到玩家入口页。
 *
 * 这是**破坏性**操作：房间只存在于服务器内存里，登出即当前对局结束，
 * 所以调用方会先让用户二次确认。
 *
 * 成功后清空整个查询缓存——该房间的 stage / 会话消息都已失效，留着只会在
 * 入口页或再次深链时显示上一个对局的残影。导航用 `replace`：房间已经没了，
 * 把被销毁的对局留在历史里只会让"后退"回到一片空白。
 */
export function useLogout(userName: string, gameName: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/logout/v1/", {
          body: { user_name: userName, game_name: gameName },
        }),
      ),
    onSuccess: () => {
      queryClient.clear();
      navigate("/entry", { replace: true });
    },
  });
}
