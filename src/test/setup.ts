import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../mocks/node";

// 默认挂 src/mocks/handlers 的共享 handlers；未注册的请求一律报错，
// 避免测试静默打到真实后端。用例内用 server.use(...) 覆盖特定接口。
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
