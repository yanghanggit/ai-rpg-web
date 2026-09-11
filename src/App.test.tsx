import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import App from "./App";
import { API_BASE_URL } from "./api/client";
import { api } from "./test/msw/handlers";
import { server } from "./test/msw/server";

function renderApp(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const serverInfoHandler = (fields: Record<string, unknown> = {}) =>
  http.get(api("/"), () =>
    HttpResponse.json({ service: "test", status: "healthy", version: "0", ...fields }),
  );

const actor = (name: string, type: string) => ({
  name,
  type,
  profile: "",
  base_body: "",
  system_message: "",
  character_stats: { hp: 1, max_hp: 1, attack: 1, defense: 1 },
  components: [],
});

const blueprint = (name: string) => ({
  name,
  player_actor: `角色.主角-${name}`,
  campaign_setting: `战役设定-${name}`,
  system_rules: "规则",
  knowledge_base: {},
  stages: [
    {
      name: `场景.门厅-${name}`,
      type: "Home",
      profile: "",
      system_message: "",
      actors: [actor("角色.顾知秋", "NPC"), actor(`角色.主角-${name}`, "NPC")],
      components: [],
    },
    {
      name: `场景.空房-${name}`,
      type: "Dungeon",
      profile: "",
      system_message: "",
      actors: [],
      components: [],
    },
  ],
  world_entities: [{ name: `世界.审计-${name}`, system_message: "", components: [] }],
});

const blueprintListHandler = (...names: string[]) =>
  http.get(api("/api/game/blueprint-list/v1/"), () =>
    HttpResponse.json({ blueprints: names.map(blueprint) }),
  );

describe("启动屏 /", () => {
  it("展示标题、服务器地址与在线状态", async () => {
    server.use(serverInfoHandler());
    renderApp();

    expect(screen.getByRole("heading", { name: "AI-RPG Web Dev" })).toBeInTheDocument();
    expect(screen.getByText(API_BASE_URL)).toBeInTheDocument();
    expect(await screen.findByText("在线 · test · healthy · v0")).toBeInTheDocument();
  });

  it("服务器不可用时禁用进入按钮，但可以重试", async () => {
    server.use(http.get(api("/"), () => HttpResponse.json({ detail: "boom" }, { status: 500 })));
    renderApp();

    expect(await screen.findByText(/无法连接/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入下一页 →" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
  });

  it("服务器可用时点击进入下一页，跳转到玩家入口", async () => {
    server.use(serverInfoHandler(), blueprintListHandler("Game1"));
    renderApp();

    const enter = screen.getByRole("button", { name: "进入下一页 →" });
    await waitFor(() => expect(enter).toBeEnabled());
    fireEvent.click(enter);

    expect(await screen.findByRole("heading", { name: "玩家入口" })).toBeInTheDocument();
  });
});

describe("玩家入口页 /entry", () => {
  it("展示自动生成的玩家名，并把蓝图作为下拉选项（默认第一个）", async () => {
    server.use(blueprintListHandler("Game1", "Game2"));
    renderApp("/entry");

    // 玩家名带日期时间，且不是输入框
    expect(await screen.findByText(/^player-\d{8}-\d{4}$/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const select = await screen.findByLabelText("游戏名");
    expect(select).toHaveValue("Game1");
    expect(screen.getByRole("option", { name: "Game2" })).toBeInTheDocument();

    // 蓝图详情：战役设定、玩家角色、Stage/Actor 映射、世界实体
    expect(screen.getByText("战役设定-Game1")).toBeInTheDocument();
    expect(screen.getByText("角色.主角-Game1")).toBeInTheDocument();
    expect(screen.getByText("场景.门厅-Game1")).toBeInTheDocument();
    expect(screen.getByText(/角色\.顾知秋（NPC）/)).toBeInTheDocument();
    expect(screen.getByText(/角色\.主角-Game1（NPC · 玩家角色）/)).toBeInTheDocument();
    expect(screen.getByText("无角色")).toBeInTheDocument();
    expect(screen.getByText("世界.审计-Game1")).toBeInTheDocument();
  });

  it("选中另一个蓝图后提交，login 与 new_game 都使用所选游戏名", async () => {
    const bodies: Array<{ path: string; body: unknown }> = [];
    server.use(
      blueprintListHandler("Game1", "Game2"),
      http.post(api("/api/login/v1/"), async ({ request }) => {
        bodies.push({ path: "/api/login/v1/", body: await request.json() });
        return HttpResponse.json({ message: "ok" });
      }),
      http.post(api("/api/game/new/v1/"), async ({ request }) => {
        bodies.push({ path: "/api/game/new/v1/", body: await request.json() });
        return HttpResponse.json({ blueprint: { name: "Game2" }, player_session: {} });
      }),
    );

    renderApp("/entry");
    fireEvent.change(await screen.findByLabelText("游戏名"), { target: { value: "Game2" } });

    // 详情跟随选择切换
    expect(await screen.findByText("世界.审计-Game2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "登录 → 新游戏" }));

    expect(await screen.findByText(/开局成功/)).toHaveTextContent("Game2");

    const expectedBody = expect.objectContaining({
      user_name: expect.stringMatching(/^player-\d{8}-\d{4}$/),
      game_name: "Game2",
    });
    expect(bodies).toEqual([
      { path: "/api/login/v1/", body: expectedBody },
      { path: "/api/game/new/v1/", body: expectedBody },
    ]);
  });

  it("蓝图列表获取失败时展示错误且不能提交", async () => {
    server.use(
      http.get(api("/api/game/blueprint-list/v1/"), () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderApp("/entry");

    expect(await screen.findByText(/无法获取蓝图列表/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录 → 新游戏" })).toBeDisabled();
  });

  it("后端返回 422 时展示错误信息", async () => {
    server.use(
      blueprintListHandler("Game1"),
      http.post(api("/api/login/v1/"), () =>
        HttpResponse.json(
          { detail: [{ loc: ["body", "user_name"], msg: "field required", type: "missing" }] },
          { status: 422 },
        ),
      ),
    );

    renderApp("/entry");
    await screen.findByLabelText("游戏名");
    fireEvent.click(screen.getByRole("button", { name: "登录 → 新游戏" }));

    expect(await screen.findByText(/出错：/)).toHaveTextContent("API 422");
  });
});
