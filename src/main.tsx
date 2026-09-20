import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

/**
 * mock 模式（pnpm dev:mock）下先启动 MSW 浏览器 worker，再渲染应用，
 * 否则首屏请求会打到真实后端。生产构建时 import.meta.env.DEV 为 false，直接跳过。
 */
async function enableMocking(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MSW !== "true") {
    return;
  }
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "warn" });
  // 深链种子：在首屏渲染前把 URL 的 `?seed=...` 变成 mock 初始状态（详见 `./mocks/seedMockFromUrl`）
  const { seedMockFromUrl } = await import("./mocks/seedMockFromUrl");
  seedMockFromUrl();
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("找不到 #root 挂载点");
}

void enableMocking().then(() => {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
});
