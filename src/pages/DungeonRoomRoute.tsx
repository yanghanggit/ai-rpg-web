import { useParams } from "react-router";
import DungeonRunGate from "../features/dungeon/DungeonRunGate";
import CombatRoomPage from "./CombatRoomPage";
import OpeningRoomPage from "./OpeningRoomPage";

/**
 * 副本房间（`/dungeon/room`）：URL 入口 + 按服务端字段 `room.type` 分发。
 *
 * 取当前房间的守卫在 `DungeonRunGate`（与地图路由共用），本层只分发到 `OpeningRoomPage` /
 * `CombatRoomPage`。房间类型是服务端派生状态、不加路由；写成二选一，将来多出第三种会编译报错。
 */
export default function DungeonRoomRoute() {
  const { userName, gameName } = useParams();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫
  if (!userName || !gameName) {
    return (
      <main className="page page--wide">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/dungeon/room</p>
      </main>
    );
  }

  return (
    <DungeonRunGate userName={userName} gameName={gameName}>
      {(room) =>
        room.type === "opening" ? (
          <OpeningRoomPage userName={userName} gameName={gameName} room={room} />
        ) : (
          <CombatRoomPage userName={userName} gameName={gameName} room={room} />
        )
      }
    </DungeonRunGate>
  );
}
