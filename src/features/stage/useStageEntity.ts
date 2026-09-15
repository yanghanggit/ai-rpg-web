/**
 * 按需查询场景实体的完整详情。
 *
 * 场景（`场景.门厅` 这类）在引擎里也是实体，details 端点按名字就能取到
 * （`get_entity_by_name` 支持任何实体类型），无需新增接口。
 * 仅在场景信息浮窗打开时请求。
 */
import { $api } from "../../api/query";

const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

export function useStageEntity(userName: string, gameName: string, stageName: string | null) {
  return $api.useQuery(
    "get",
    DETAILS_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { entities: [stageName ?? ""] },
      },
    },
    { enabled: stageName !== null },
  );
}
