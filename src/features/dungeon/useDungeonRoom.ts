/**
 * 当前副本房间（`GET /api/dungeons/v1/{user}/{game}/room`）。
 *
 * 只返回当前房间，不含副本本体（进度在 `useDungeonRun`）。房间是判别联合（`opening` / `combat`），
 * **没有自己的名字**：界面上的房间名就是 `room.stage.name`。
 * 没有进行中的房间时后端返 **404**，客户端不兜底，错误原样交给页面显示。
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
