import { execFileSync } from "node:child_process";
import { loadEnv } from "vite";

/**
 * 从后端 OpenAPI 生成 TypeScript 类型到 src/api/schema.d.ts。
 *
 * 地址解析顺序（后者为前者兜底）：
 *   1. shell 环境变量 VITE_OPENAPI_URL / VITE_API_BASE_URL
 *   2. .env / .env.local 中的同名变量（复用 Vite 的加载逻辑）
 *   3. OpenAPI 缺省时取 `${VITE_API_BASE_URL}/openapi.json`
 *   4. 全部缺省时回退 http://localhost:8000
 *
 * 用法：pnpm gen:api（需后端已启动）
 */
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "VITE_");

const baseUrl = (
  process.env.VITE_API_BASE_URL ??
  env.VITE_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

const url = process.env.VITE_OPENAPI_URL ?? env.VITE_OPENAPI_URL ?? `${baseUrl}/openapi.json`;

console.log(`Generating types from ${url} ...`);
execFileSync("openapi-typescript", [url, "-o", "src/api/schema.d.ts"], {
  stdio: "inherit",
});
console.log("Done: src/api/schema.d.ts");
