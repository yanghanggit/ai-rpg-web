/**
 * 默认 MSW handlers。
 *
 * - mock 模式（pnpm dev:mock）：浏览器 worker 用这套 handler 返回 fixtures。
 * - 单元测试：node server 默认挂这套 handler；用例内用 `server.use(...)` 覆盖特定接口。
 *
 * 新增页面需要 mock 时，把该页依赖的接口加到这里即可，测试与调试同时生效。
 */
import { HttpResponse, http } from "msw";
import { API_BASE_URL } from "../api/client";
import {
  blueprintListFixture,
  homeStagesFixture,
  newGameFixture,
  serverInfoFixture,
} from "./fixtures";

/** 把后端相对路径补成完整 URL，供 MSW handler 匹配。 */
export function api(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export const handlers = [
  http.get(api("/"), () => HttpResponse.json(serverInfoFixture)),

  http.get(api("/api/game/blueprint-list/v1/"), () => HttpResponse.json(blueprintListFixture)),

  http.post(api("/api/login/v1/"), () => HttpResponse.json({ message: "mock 登录成功" })),

  http.post(api("/api/game/new/v1/"), () => HttpResponse.json(newGameFixture)),

  http.get(api("/api/stages/v1/:userName/:gameName/state"), () =>
    HttpResponse.json(homeStagesFixture),
  ),
];
