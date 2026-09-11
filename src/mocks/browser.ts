/**
 * 浏览器端 MSW：仅在 `pnpm dev:mock`（Vite --mode mock）时由 main.tsx 动态加载。
 * 生产构建中 import.meta.env.DEV 为 false，这段代码不会执行。
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
