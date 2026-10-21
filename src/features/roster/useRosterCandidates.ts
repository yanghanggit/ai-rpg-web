/**
 * 可加入队伍的候选同伴。
 *
 * 准入是持有 `NPCComponent`，但**不能只按这一条筛**：玩家实体的蓝图类型往往也是 NPC，于是同时带
 * `NPCComponent` 与 `PlayerComponent`，必须再 `none_of=PlayerComponent` 排除。
 */
import { $api } from "../../api/query";
import { COMPONENT } from "../entities/componentNames";
import { entityNames } from "../entities/ecs";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

export function useRosterCandidates(userName: string, gameName: string) {
  return $api.useQuery(
    "get",
    GROUP_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { all_of: [COMPONENT.NPC], none_of: [COMPONENT.Player] },
      },
    },
    { select: (data) => entityNames(data.entities) },
  );
}
