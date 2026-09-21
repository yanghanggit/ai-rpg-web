import { useNavigate } from "react-router";
import type { Schemas } from "../api/types";
import OpeningRoomPanel from "../features/dungeon/opening/OpeningRoomPanel";
import RoomScaffold from "../features/dungeon/RoomScaffold";
import { readRoomGuards } from "../features/dungeon/readRoomGuards";

/**
 * 开场房间整页（`room.type === "opening"`）。
 *
 * 与 `CombatRoomPage` 共用 `RoomScaffold`（标题 / 副本信息 / 叙事 / 离开副本），
 * 这里只写**开场房间与别的房间不同的那两点**：
 * - 「离开副本」的前置禁用（服务端要求先初始化完才能退出，否则 409）——判据统一走
 *   `readRoomGuards`，不再各页各写一份；
 * - 本间**结束动作的去处**：回地图（`onFinishRoom`）。房间不认识路由，所以导航由页面接线。
 *
 * 正文交给 `OpeningRoomPanel`（初始化 → 生成奖励 → 领卡 → 结束本间）。房间结束后进的是**地图**
 * 而不是下一间：前进是地图上的动作（`rooms[current_room_index + 1]` 才是下一间）。
 *
 * 路由入口是 `DungeonRoomRoute`：它取回当前房间后按服务端判别字段 `room.type` 分发到这里。
 */
export default function OpeningRoomPage({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: Schemas["OpeningRoom"];
}) {
  const navigate = useNavigate();
  const guards = readRoomGuards(room);

  return (
    <RoomScaffold
      userName={userName}
      gameName={gameName}
      roomName={room.stage.name}
      exitBlocked={guards.exitBlocked}
      exitBlockedHint={guards.exitBlockedHint ?? undefined}
    >
      <OpeningRoomPanel
        userName={userName}
        gameName={gameName}
        room={room}
        // 副本内一律 replace：没有"后退"，只有前进与放弃离开（见 DungeonMapPanel）
        onFinishRoom={() =>
          navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true })
        }
      />
    </RoomScaffold>
  );
}
