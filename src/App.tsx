import { Route, Routes } from "react-router";
import DevIndexPage from "./pages/DevIndexPage";
import DungeonMapPage from "./pages/DungeonMapPage";
import DungeonOverviewPage from "./pages/DungeonOverviewPage";
import DungeonRoomRoute from "./pages/DungeonRoomRoute";
import HomeOverviewPage from "./pages/HomeOverviewPage";
import LaunchPage from "./pages/LaunchPage";
import LobbyPage from "./pages/LobbyPage";

/**
 * 路由表。页面组件放 src/pages/，领域逻辑放 src/features/。
 * Provider（QueryClient、Router）在 main.tsx 装配，便于测试用 MemoryRouter 替换。
 *
 * 游戏页一律带会话参数（/game/:userName/:gameName/...），这样"地址即状态"，
 * 可以直接深链到任意一层，不必每次走完启动屏 → 玩家入口。
 */ export default function App() {
  return (
    <>
      {import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === "true" ? (
        <div className="mock-badge">MOCK 模式 · 数据来自 src/mocks/fixtures.ts</div>
      ) : null}

      <Routes>
        <Route path="/" element={<LaunchPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game/:userName/:gameName/home" element={<HomeOverviewPage />} />
        <Route path="/game/:userName/:gameName/dungeon" element={<DungeonOverviewPage />} />
        {/* 副本进行中：**地图**是房间之间那一站（进入副本的落点、房间结束后的归处），
            它在服务端没有对应物，只是把「队伍在哪一间 + 进度」画出来 */}
        <Route path="/game/:userName/:gameName/dungeon/map" element={<DungeonMapPage />} />
        {/* 副本进行中：房间（开场 / 战斗）——房间类型由 DungeonRoomRoute 从 /room 解析 */}
        <Route path="/game/:userName/:gameName/dungeon/room" element={<DungeonRoomRoute />} />
        {import.meta.env.DEV ? <Route path="/dev" element={<DevIndexPage />} /> : null}
      </Routes>
    </>
  );
}
