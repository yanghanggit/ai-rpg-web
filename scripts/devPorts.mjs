/**
 * 本地 dev server 端口的**唯一来源**。
 *
 * 为什么值得单独一个文件：端口一旦在多处各写一遍，就变成了「假设」，而最坏的结果不是
 * 报错，是**悄悄指向另一台服务器**——本机 5173 上跑着连真实后端的 dev server 时，
 * 任何「默认 5173」的工具都会拍到它，而你以为拍的是 mock。所以：
 * 数字只写在这里，别处一律 import（`pnpm lint` 会用 scripts/checkDevPorts.mjs 检查）。
 *
 * 两个模式用**不同**端口是刻意的：
 * - 真数据与假数据可以同时开着对比；
 * - 各自有确定的名字，文档与工具可以放心引用（不必再猜「5173 被占后会变成几」）。
 * 并且 `vite.config.ts` 配了 `strictPort`：被占用时**直接启动失败**，不静默顺延。
 */

/** `pnpm dev`（连真实后端）的端口。 */
export const DEV_PORT = 5173;

/** `pnpm dev:mock`（浏览器端 MSW 假数据）的端口；与 DEV_PORT 分开，两个可同时开。 */
export const MOCK_PORT = 5273;

/** 端口 → `http://localhost:<port>`，省得各处再各写一遍主机名。 */
export function localBaseUrl(port) {
  return `http://localhost:${port}`;
}
