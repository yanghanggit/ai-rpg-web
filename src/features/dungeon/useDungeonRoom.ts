/**
 * 当前副本房间（`GET /api/dungeons/v1/{user}/{game}/room`）。
 *
 * 后端只返回**当前房间**，不含副本本体：房间是判别联合（`room.type` = `opening` / `combat`），
 * 房间**没有自己的名字**——界面上的房间名就是 `room.stage.name`（副本房间与场景一一对应）。
 *
 * 没有进行中的房间时（`current_room_index == -1`，例如已退出副本）后端返回 **404**
 * 「当前副本没有进行中的房间」。客户端不为它兜底：错误原样交给页面显示。
 *
 * 副本本体（含进度 `current_room_index`）在 `useDungeonRun` 那条查询里，两者各管一件事。
 */
import { $api } from "../../api/query";

export function useDungeonRoom(userName: string, gameName: string) {
  return $api.useQuery(
    "get",
    "/api/dungeons/v1/{user_name}/{game_name}/room",
    { params: { path: { user_name: userName, game_name: gameName } } },
    { select: (data) => data.room },
  );
}
