import { useParams } from "react-router";
import DungeonRunGate from "../features/dungeon/DungeonRunGate";
import CombatRoomPage from "./CombatRoomPage";
import OpeningRoomPage from "./OpeningRoomPage";

/**
 * 副本房间（`/game/:user/:game/dungeon/room`）：**URL 入口 + 房间类型分发器**。
 *
 * 命名用 `Route` 而不是 `Page`：`pages/` 里的名字分两种——**绑定 URL 的入口**（`*Route`，
 * 可能只做解析 / 分发、不渲染屏幕）与**具体屏幕**（`*Page`）。这一层是前者：它自己不画屏幕，
 * 只把整页交给两个房间页；若叫 `DungeonRoomPage` 会和 `OpeningRoomPage` / `CombatRoomPage`
 * 并列读成「基类 + 子类」，而共同框架其实在 `RoomScaffold`。
 *
 * 这一层只做两件事：
 * - 取回当前房间、处理「加载中 / 没有进行中的房间」——这段**守卫**抽在 `DungeonRunGate` 里，
 *   与地图路由（`DungeonMapPage`）共用同一份；
 * - 按服务端判别字段 `room.type` 把整页交给 `OpeningRoomPage` 或 `CombatRoomPage`。
 *
 * **房间类型是服务端派生状态，不是导航状态**，所以刻意**不**给它加路由（对照 `combatPhase`
 * 与 `seedMockFromUrl` 的同一条原则）：路径始终是 `/dungeon/room`，两个房间页各自成页、
 * 各自维护。写成二选一而非无 `default` 的 `switch`，后端将来多出第三种房间类型时会**编译报错**，
 * 不会静默渲染空白。
 *
 * 「进入副本」后的落点是**地图**（`/dungeon/map`，房间之间那一站），不是这里：玩家先在地图上看到
 * "本次副本有哪几间"，再自己走进第 1 间；房间结束后也回那里。所以 `room.type` 这条分叉只在
 * "人已经在房间里"时才参与。
 *
 * 刻意**不**提供「返回副本总览」：按游戏逻辑，副本内只有前进与放弃离开，没有别的去处。
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
