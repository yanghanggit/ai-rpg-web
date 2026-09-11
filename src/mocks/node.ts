/**
 * Node 端 MSW：供 Vitest 使用（见 src/test/setup.ts）。
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
