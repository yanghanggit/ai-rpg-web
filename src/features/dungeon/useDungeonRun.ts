/**
 * 当前副本的运行状态（`GET .../state`）：`active = current_room_index >= 0`。
 * 退出副本后后端把副本重置回空副本，所以这场判据自行复位。
 */
import { $api } from "../../api/query";

export function useDungeonRun(userName: string, gameName: string) {
  return $api.useQuery(
    "get",
    "/api/dungeons/v1/{user_name}/{game_name}/state",
    { params: { path: { user_name: userName, game_name: gameName } } },
    {
      select: (data) => ({
        /** 运行中的副本；没有副本时后端返回空名空房间的副本。 */
        dungeon: data.dungeon,
        /** 有副本正在进行中。 */
        active: data.dungeon.current_room_index >= 0,
      }),
    },
  );
}
