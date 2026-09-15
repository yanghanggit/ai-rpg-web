/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { DEV_PORT, MOCK_PORT } from "./scripts/devPorts.mjs";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    // 监听 0.0.0.0，局域网内其他设备可直接访问（Vite 启动时会打印 Network 地址）
    host: true,
    // 端口来自 scripts/devPorts.mjs（唯一来源）：真后端与 mock 各有固定端口，可同时开
    port: mode === "mock" ? MOCK_PORT : DEV_PORT,
    // 被占用就直接失败，**不要**静默顺延：那样脚本默认值、文档示例里的 dev 端口
    // 会指向另一台（可能是别人的、连着真实后端的）dev server，且看不出异常。
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
}));
