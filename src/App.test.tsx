import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { expect, it } from "vitest";
import App from "./App";
import { api } from "./test/msw/handlers";
import { server } from "./test/msw/server";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

const serverInfoHandler = () =>
  http.get(api("/"), () => HttpResponse.json({ service: "test", status: "healthy", version: "0" }));

it("通过 $api.useQuery 展示服务器状态", async () => {
  server.use(serverInfoHandler());

  renderApp();

  expect(screen.getByRole("heading", { name: "AI-RPG Web" })).toBeInTheDocument();
  expect(await screen.findByText("test · healthy · v0")).toBeInTheDocument();
});

it("点击按钮后依次调用 login 与 new_game，并携带正确请求体", async () => {
  const bodies: Array<{ path: string; body: unknown }> = [];

  server.use(
    serverInfoHandler(),
    http.post(api("/api/login/v1/"), async ({ request }) => {
      bodies.push({ path: "/api/login/v1/", body: await request.json() });
      return HttpResponse.json({ message: "ok" });
    }),
    http.post(api("/api/game/new/v1/"), async ({ request }) => {
      bodies.push({ path: "/api/game/new/v1/", body: await request.json() });
      return HttpResponse.json({ blueprint: { name: "测试蓝图" }, player_session: {} });
    }),
  );

  renderApp();
  await screen.findByText("test · healthy · v0");

  fireEvent.click(screen.getByRole("button", { name: "登录 → 新游戏" }));

  expect(await screen.findByText(/开局成功/)).toHaveTextContent("测试蓝图");
  expect(bodies).toEqual([
    { path: "/api/login/v1/", body: { user_name: "tester", game_name: "demo" } },
    { path: "/api/game/new/v1/", body: { user_name: "tester", game_name: "demo" } },
  ]);
});

it("后端返回 422 时展示错误信息", async () => {
  server.use(
    serverInfoHandler(),
    http.post(api("/api/login/v1/"), () =>
      HttpResponse.json(
        { detail: [{ loc: ["body", "user_name"], msg: "field required", type: "missing" }] },
        { status: 422 },
      ),
    ),
  );

  renderApp();
  await screen.findByText("test · healthy · v0");

  fireEvent.click(screen.getByRole("button", { name: "登录 → 新游戏" }));

  expect(await screen.findByText(/出错：/)).toHaveTextContent("API 422");
});
