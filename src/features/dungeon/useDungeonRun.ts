/**
 * 当前是否有副本正在进行（`GET /api/dungeons/v1/{user}/{game}/state`）。
 *
 * 后端把「进行中」记在副本的 `current_room_index` 上：未进入为 `-1`，进入第一关后为 `0`；
 * 退出副本时 `teardown_dungeon` 会把 `world.dungeon` 重置回空副本，所以这个判据会自行复位。
 *
 * 用途：进入副本的前提是「当前没有副本在跑」（否则 `setup_dungeon` 直接拒绝），
 * 客户端据此在进入前拦住，而不是等后端报错。
 */
import { $api } from "../../api/query";

export function useDungeonRun(userName: string, gameName: string) {
  return $api.useQuery(
    "get",
    "/api/dungeons/v1/{user_name}/{game_name}/state",
    { params: { path: { user_name: userName, game_name: gameName } } },
    {
      select: (data) => ({
        active: data.dungeon.current_room_index >= 0,
        /** 进行中的副本名；没有副本时后端返回空名副本。 */
        name: data.dungeon.name,
      }),
    },
  );
}
