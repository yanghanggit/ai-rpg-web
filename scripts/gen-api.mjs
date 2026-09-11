import { execFileSync } from "node:child_process";

/**
 * 从后端 OpenAPI 生成 TypeScript 类型到 src/api/schema.d.ts。
 * 地址由 VITE_OPENAPI_URL 覆盖，默认 http://localhost:8000/openapi.json。
 * 用法：pnpm gen:api（需后端已启动）
 */
const url = process.env.VITE_OPENAPI_URL ?? "http://localhost:8000/openapi.json";

console.log(`Generating types from ${url} ...`);
execFileSync("openapi-typescript", [url, "-o", "src/api/schema.d.ts"], {
  stdio: "inherit",
});
console.log("Done: src/api/schema.d.ts");
