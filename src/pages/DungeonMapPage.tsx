import { Navigate, useParams } from "react-router";
import type { Schemas } from "../api/types";
import DungeonRunGate from "../features/dungeon/DungeonRunGate";
import DungeonMapPanel from "../features/dungeon/map/DungeonMapPanel";
import RoomScaffold from "../features/dungeon/RoomScaffold";
import { readRoomGuards } from "../features/dungeon/readRoomGuards";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";

/**
 * 副本地图整页（`/game/:user/:game/dungeon/map`）：**房间之间那一站**。
 *
 * 取当前房间（`DungeonRunGate`）→ 套 `RoomScaffold`（不显示自己的「地图」入口）→ 正文交给
 * `DungeonMapPanel`。战斗没结束时转发回房间（URL / 收藏 / 返回键到得了这里）。
 */
export default function DungeonMapPage() {
  const { userName, gameName } = useParams();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫
  if (!userName || !gameName) {
    return (
      <main className="page page--wide">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/dungeon/map</p>
      </main>
    );
  }

  return (
    <DungeonRunGate userName={userName} gameName={gameName}>
      {(room) => <DungeonMap userName={userName} gameName={gameName} room={room} />}
    </DungeonRunGate>
  );
}

function DungeonMap({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: Schemas["DungeonRoomResponse"]["room"];
}) {
  const guards = readRoomGuards(room);
  const exit = useExitDungeon(userName, gameName);

  // 战斗未结束就到了地图：队伍就在那间房里，送回房间
  if (!guards.done && room.type === "combat") {
    return <Navigate to={`/game/${userName}/${gameName}/dungeon/room`} replace />;
  }

  return (
    <RoomScaffold userName={userName} gameName={gameName} exit={exit} showMap={false}>
      <DungeonMapPanel userName={userName} gameName={gameName} room={room} />
    </RoomScaffold>
  );
}
