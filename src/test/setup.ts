import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../mocks/node";
import { resetMockSessionMessages } from "../mocks/sessionMessages";
import { resetMockTasks } from "../mocks/tasks";

// 默认挂 src/mocks/handlers 的共享 handlers；未注册的请求一律报错，
// 避免测试静默打到真实后端。用例内用 server.use(...) 覆盖特定接口。
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // mock 里的内存状态（任务表、会话消息表）也要复位，否则用例之间会互相污染
  resetMockTasks();
  resetMockSessionMessages();
});
afterAll(() => server.close());
