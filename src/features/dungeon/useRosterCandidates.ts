/**
 * 可加入队伍的候选同伴。
 *
 * 准入条件是持有 `NPCComponent`（后端 `add_party_member` 也这么判），但**不能只按这一条筛**：
 * `ActorType` 只有 NPC / Monster 两种，玩家角色的蓝图类型往往也是 NPC，
 * 于是玩家实体会同时带 `NPCComponent` 与 `PlayerComponent`，必须再用
 * `none_of=PlayerComponent` 把它排除（group 端点支持三组条件）。
 */
import { $api } from "../../api/query";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

export function useRosterCandidates(userName: string, gameName: string) {
  return $api.useQuery(
    "get",
    GROUP_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { all_of: ["NPCComponent"], none_of: ["PlayerComponent"] },
      },
    },
    { select: (data) => data.entities.map((entity) => entity.name) },
  );
}
