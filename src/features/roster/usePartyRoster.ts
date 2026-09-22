/**
 * 读取本次副本预选的同伴名单（`PartyRosterComponent`）。
 *
 * 该组件挂在**玩家实体**上，名单为空时后端会直接移除组件，所以用 group 端点按组件过滤：
 * 有组件就返回玩家实体，没有就返回空列表——不需要先解析玩家角色名，天然自包含。
 */
import { $api } from "../../api/query";
import { COMPONENT } from "../entities/componentNames";
import { readPartyRoster } from "./readPartyRoster";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

export function usePartyRoster(userName: string, gameName: string) {
  return $api.useQuery(
    "get",
    GROUP_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { all_of: [COMPONENT.PartyRoster] },
      },
    },
    {
      // 至多一个实体（只有玩家有该组件）；组件缺失即空名单
      select: (data) => (data.entities[0] ? readPartyRoster(data.entities[0]) : []),
    },
  );
}
