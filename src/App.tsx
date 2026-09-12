import { Route, Routes } from "react-router";
import DevIndexPage from "./pages/DevIndexPage";
import EntryPage from "./pages/EntryPage";
import HomeOverviewPage from "./pages/HomeOverviewPage";
import LaunchPage from "./pages/LaunchPage";

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
        <Route path="/entry" element={<EntryPage />} />
        <Route path="/game/:userName/:gameName/home" element={<HomeOverviewPage />} />
        {import.meta.env.DEV ? <Route path="/dev" element={<DevIndexPage />} /> : null}
      </Routes>
    </>
  );
}
