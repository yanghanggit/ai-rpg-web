/**
 * 浏览器端 MSW：仅在 `pnpm dev:mock`（Vite --mode mock）时由 main.tsx 动态加载。
 * 生产构建中 import.meta.env.DEV 为 false，这段代码不会执行。
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { addMockRosterMember } from "./roster";

/**
 * 只看 `pnpm dev:mock` 才有的初始档案：默认带一个同伴。
 *
 * 放在这里而不是 `roster.ts` 的初始值里：`./handlers` 与单元测试共用，测试要的是空名单
 * （队伍人数、行动顺序这些断言都建立在「只有玩家」上），所以"演示用的初始队伍"只属于浏览器 mock。
 * 进副本那一刻固化队伍，所以在首屏渲染前补名单就够了。
 */
addMockRosterMember("角色.坏运气");

export const worker = setupWorker(...handlers);
