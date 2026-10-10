/**
 * 「已永久失能」的角色名集合（家园页用）。
 *
 * 失能是标记组件（`IncapacitatedComponent`），而 `stages state` 只返回角色名，判断不了谁失能。
 * 这里走 group 端点按组件名筛一次，得到名字集合，供场景卡 / 实体浏览器 / 场景浮窗给失能角色打标。
 * 与「候选同伴」同源，都是 `all_of` 单条件查询。
 *
 * 只取名字（失能角色仍留在场景里，只是不再行动），所以不需要 details。
 */
import { $api } from "../../api/query";
import { COMPONENT } from "../entities/componentNames";
import { entityNames } from "../entities/ecs";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";

export function useIncapacitatedActors(userName: string, gameName: string) {
  return $api.useQuery(
    "get",
    GROUP_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { all_of: [COMPONENT.Incapacitated] },
      },
    },
    { select: (data) => entityNames(data.entities) },
  );
}
