/**
 * 当前副本的运行状态（`GET /api/dungeons/v1/{user}/{game}/state`）。
 *
 * 后端把「进行中」记在副本的 `current_room_index` 上：未进入为 `-1`，进入第一关后为 `0`；
 * 退出副本时 `teardown_dungeon` 会把 `world.dungeon` 重置回空副本，所以这个判据会自行复位。
 *
 * 两处用到：
 * - 副本总览页：进入副本的前提是「当前没有副本在跑」（否则 `setup_dungeon` 直接拒绝），
 *   客户端据此在进入前拦住，而不是等后端报错；
 * - 副本房间页：「地图」浮窗（以及战斗房的「战斗信息」）要看运行中副本，所以把副本本体也一并给出
 *   （进度就是它自己的字段 `current_room_index`，见 `readDungeonInfo`）。
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
