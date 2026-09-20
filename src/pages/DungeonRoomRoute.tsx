import { useNavigate, useParams } from "react-router";
import { describeApiError } from "../api/describeApiError";
import { useDungeonRoom } from "../features/dungeon/useDungeonRoom";
import CombatRoomPage from "./CombatRoomPage";
import OpeningRoomPage from "./OpeningRoomPage";

/**
 * 副本进行中（房间页）：**路由入口 + 房间类型解析器（网关）**。
 *
 * 命名用 `Route` 而不是 `Page`：`pages/` 里的名字分两种——**绑定 URL 的入口**（`*Route`，
 * 可能只做解析 / 分发、不渲染屏幕）与**具体屏幕**（`*Page`）。这一层是前者：它自己不画屏幕，
 * 只把整页交给两个房间页；若叫 `DungeonRoomPage` 会和 `OpeningRoomPage` / `CombatRoomPage`
 * 并列读成「基类 + 子类」，而共同框架其实在 `RoomScaffold`。
 *
 * 「进入副本」成功后切到这里——玩家的场景已经变成副本第一关，总览页那一刻起已无事可做，
 * 而家园接口在副本进行中会被后端拒绝，所以玩家需要一个明确知道自己在副本里的落点。
 *
 * 这一层只做两件事：
 * - 拉当前房间（`GET /api/dungeons/v1/{user}/{game}/room`）并处理「加载中 / 没有进行中的房间」；
 * - 按服务端判别字段 `room.type` 把整页交给 `OpeningRoomPage` 或 `CombatRoomPage`。
 *
 * **房间类型是服务端派生状态，不是导航状态**，所以刻意**不**给它加路由（对照 `combatPhase`
 * 与 `seedMockFromUrl` 的同一条原则）：路径始终是 `/dungeon/room`，两个房间页各自成页、
 * 各自维护（见 `OpeningRoomPage` / `CombatRoomPage`）。写成二选一而非无 `default` 的 `switch`，
 * 后端将来多出第三种房间类型时会**编译报错**，不会静默渲染空白。
 *
 * 两个房间页共用 `RoomScaffold`（标题 / 副本信息 / 叙事 / 离开副本）。「离开副本」按房间类型
 * 只差一处前置禁用：开场房间未初始化时禁用（服务端 409），战斗房间不预判（战斗未结束退出由
 * 后端拦）。没有进行中的房间时 `/room` 返回 404（已退出 / 已结束），错误原样显示，并给一个
 * 「← 返回家园」的出口。
 *
 * 刻意**不**提供「返回副本总览」：按游戏逻辑，离开副本就是回家园（`→ /game/.../home`），
 * 副本进行中也没有别的去处。
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

  return <ResolveRoom userName={userName} gameName={gameName} />;
}

function ResolveRoom({ userName, gameName }: { userName: string; gameName: string }) {
  const navigate = useNavigate();
  const room = useDungeonRoom(userName, gameName);

  const homePath = `/game/${userName}/${gameName}/home`;

  if (room.isPending) {
    return (
      <main className="page page--wide">
        <p className="muted">加载中…</p>
      </main>
    );
  }

  if (room.isError) {
    return (
      <main className="page page--wide">
        {/* 没有进行中的房间时后端返回 404（副本已退出 / 已结束），错误原样显示，不替它兜底 */}
        <p className="error">无法获取当前房间：{describeApiError(room.error)}</p>
        <div className="toolbar">
          {/* 副本已经结束时这一屏无事可做，唯一的去处就是家园 */}
          <button type="button" onClick={() => navigate(homePath)}>
            ← 返回家园
          </button>
        </div>
      </main>
    );
  }

  return room.data.type === "opening" ? (
    <OpeningRoomPage userName={userName} gameName={gameName} room={room.data} />
  ) : (
    <CombatRoomPage userName={userName} gameName={gameName} room={room.data} />
  );
}
