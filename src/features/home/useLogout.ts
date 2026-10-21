import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { client, unwrap } from "../../api/client";

/**
 * 登出并回到玩家入口页（**破坏性**：对局只存在于服务器内存里，登出即当前对局结束）。
 *
 * 成功后清空整个查询缓存，否则入口页或再次深链会看到上一局的残影；导航用 `replace`，
 * 房间已经没了，不把销毁的对局留在历史里。
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
      navigate("/lobby", { replace: true });
    },
  });
}
