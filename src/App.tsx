import { Route, Routes } from "react-router";
import EntryPage from "./pages/EntryPage";
import LaunchPage from "./pages/LaunchPage";

/**
 * 路由表。页面组件放 src/pages/，领域逻辑放 src/features/。
 * Provider（QueryClient、Router）在 main.tsx 装配，便于测试用 MemoryRouter 替换。
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LaunchPage />} />
      <Route path="/entry" element={<EntryPage />} />
    </Routes>
  );
}
