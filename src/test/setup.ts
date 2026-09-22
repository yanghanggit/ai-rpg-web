import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetUnreadBaselines } from "../features/session/unreadBaselines";
import { resetMockCombatState } from "../mocks/combat";
import { resetMockDungeons } from "../mocks/dungeons";
import { resetMockItems } from "../mocks/items";
import { server } from "../mocks/node";
import { resetMockOpening } from "../mocks/opening";
import { resetMockRoster } from "../mocks/roster";
import { resetMockSessionMessages } from "../mocks/sessionMessages";
import { resetMockStages } from "../mocks/stages";
import { resetMockTasks } from "../mocks/tasks";

// jsdom 没有布局 / 滚动实现，`scrollIntoView` 直接抛错。给个空实现——组件里该滚就滚，
// 测试环境只是不真的滚（视觉效果交给 `pnpm screenshot` 核对）。
Element.prototype.scrollIntoView = () => {};

// 默认挂 src/mocks/handlers 的共享 handlers；未注册的请求一律报错，
// 避免测试静默打到真实后端。用例内用 server.use(...) 覆盖特定接口。
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // mock 里的内存状态（任务表、会话消息表）也要复位，否则用例之间会互相污染
  resetMockTasks();
  resetMockSessionMessages();
  resetMockStages();
  resetMockItems();
  resetMockRoster();
  resetMockDungeons();
  resetMockOpening();
  resetMockCombatState();
  // 叙事未读基线是模块级状态，不随组件卸载消失，测试之间必须显式复位
  resetUnreadBaselines();
});
afterAll(() => server.close());
