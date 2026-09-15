import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { API_BASE_URL } from "./api/client";
import type { Schemas } from "./api/types";
import { blueprintFixture, serverInfoFixture } from "./mocks/fixtures";
import { api } from "./mocks/handlers";
import { server } from "./mocks/node";

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

const serverInfoHandler = (fields: Partial<Schemas["ServerInfoResponse"]> = {}) =>
  http.get(api("/"), () =>
    HttpResponse.json({
      ...serverInfoFixture,
      service: "test",
      status: "healthy",
      version: "0",
      ...fields,
    }),
  );

const blueprintWithName = (name: string): Schemas["Blueprint"] => ({
  ...blueprintFixture,
  name,
  player_actor: `角色.主角-${name}`,
  campaign_setting: `战役设定-${name}`,
});

describe("启动屏 /", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("mock 模式下展示 MOCK 徽标，提醒当前看到的是假数据", async () => {
    vi.stubEnv("VITE_ENABLE_MSW", "true");
    renderApp();

    expect(screen.getByText(/MOCK 模式/)).toBeInTheDocument();
  });

  it("非 mock 模式不展示 MOCK 徽标", async () => {
    renderApp();

    expect(screen.queryByText(/MOCK 模式/)).not.toBeInTheDocument();
  });

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
    server.use(serverInfoHandler());
    renderApp();

    const enter = screen.getByRole("button", { name: "进入下一页 →" });
    await waitFor(() => expect(enter).toBeEnabled());
    fireEvent.click(enter);

    expect(await screen.findByRole("heading", { name: "玩家入口" })).toBeInTheDocument();
  });
});

/** 取某个 <summary> 所属的 <details>，用来断言默认展开/折叠。 */
function detailsFor(label: string | RegExp): HTMLElement {
  const details = screen.getByText(label).closest("details");
  if (!(details instanceof HTMLElement)) {
    throw new Error(`找不到「${String(label)}」所属的 details`);
  }
  return details;
}

describe("玩家入口页 /entry", () => {
  it("展示自动生成的玩家名、蓝图下拉，以及所选蓝图详情", async () => {
    renderApp("/entry");

    // 玩家名带日期时间，且不是输入框
    expect(await screen.findByText(/^player-\d{8}-\d{6}-[0-9a-f]{8}$/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const select = await screen.findByLabelText("游戏名");
    expect(select).toHaveValue("Game1");

    // 蓝图详情（来自共享 fixture）：玩家角色 / 战役设定 / 场景-角色 / 世界实体
    expect(screen.getByText("无名")).toBeInTheDocument();
    expect(
      screen.getByText("（mock）这是一个架空的、融合狩猎玩法的中式民俗志怪游戏世界。"),
    ).toBeInTheDocument();
    expect(screen.getByText("门厅")).toBeInTheDocument();
    expect(screen.getByText(/顾知秋（NPC）/)).toBeInTheDocument();
    expect(screen.getByText(/无名（NPC · 玩家角色）/)).toBeInTheDocument();
    expect(screen.getAllByText("无角色")).toHaveLength(1);
    expect(screen.getByText("储物箱")).toBeInTheDocument();
  });

  it("蓝图详情标题带当前蓝图名；世界实体与两个道具容器默认折叠", async () => {
    renderApp("/entry");

    expect(await screen.findByRole("heading", { name: "蓝图详情：Game1" })).toBeInTheDocument();

    expect(detailsFor("战役设定")).toHaveAttribute("open");
    expect(detailsFor(/^场景与角色（/)).toHaveAttribute("open");
    expect(detailsFor(/^世界实体（/)).not.toHaveAttribute("open");
    // 道具没有外层嵌套，直接是「随身背包」「储物箱」两项
    expect(detailsFor(/^随身背包（/)).not.toHaveAttribute("open");
    expect(detailsFor(/^储物箱（/)).not.toHaveAttribute("open");
  });

  it("物品显示类型标签、名字与数量", async () => {
    renderApp("/entry");

    expect(await screen.findByText(/^随身背包（2）/)).toBeInTheDocument();
    expect(screen.getByText(/^储物箱（1）/)).toBeInTheDocument();

    // 折叠只是视觉上的，内容仍在 DOM 里
    expect(screen.getByText("缠麻短刃")).toBeInTheDocument();
    expect(screen.getByText("吗啡针剂")).toBeInTheDocument();
    expect(screen.getByText("×2")).toBeInTheDocument();
    expect(screen.getByText("（mock）由旧铁剪反复磨砺而成的短刃。")).toBeInTheDocument();
    expect(screen.getByText("旧麻绳")).toBeInTheDocument();
    expect(screen.getByText("×3")).toBeInTheDocument();
  });

  it("切换蓝图后，详情标题与内容跟着变（名字是动态读的）", async () => {
    server.use(
      http.get(api("/api/game/blueprint-list/v1/"), () =>
        HttpResponse.json({
          blueprints: [blueprintWithName("Game1"), blueprintWithName("Game2")],
        }),
      ),
    );

    renderApp("/entry");
    expect(await screen.findByRole("heading", { name: "蓝图详情：Game1" })).toBeInTheDocument();
    expect(screen.getByText("战役设定-Game1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("游戏名"), { target: { value: "Game2" } });

    expect(screen.getByRole("heading", { name: "蓝图详情：Game2" })).toBeInTheDocument();
    expect(screen.getByText("战役设定-Game2")).toBeInTheDocument();
  });

  it("选中另一个蓝图提交后，跳到家园页，且两个请求都使用所选游戏名", async () => {
    const bodies: Array<{ path: string; body: unknown }> = [];
    let groupCalls = 0;
    server.use(
      http.get(api("/api/game/blueprint-list/v1/"), () =>
        HttpResponse.json({
          blueprints: [blueprintWithName("Game1"), blueprintWithName("Game2")],
        }),
      ),
      http.post(api("/api/login/v1/"), async ({ request }) => {
        bodies.push({ path: "/api/login/v1/", body: await request.json() });
        return HttpResponse.json({ message: "ok" });
      }),
      http.post(api("/api/game/new/v1/"), async ({ request }) => {
        bodies.push({ path: "/api/game/new/v1/", body: await request.json() });
        return HttpResponse.json({
          blueprint: blueprintWithName("Game2"),
          player_session: {
            name: "p",
            actor: "a",
            game: "Game2",
            session_messages: [],
            event_sequence: 0,
          },
        });
      }),
      // 开局已缓存 player_actor；家园页若把它用上，就不该再查 group
      http.get(api("/api/entities/v1/:userName/:gameName/group"), () => {
        groupCalls += 1;
        return HttpResponse.json({ entities: [] });
      }),
    );

    renderApp("/entry");
    fireEvent.change(await screen.findByLabelText("游戏名"), { target: { value: "Game2" } });
    expect(await screen.findByText(/主角-Game2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "登录 → 新游戏" }));

    // 开局成功后自动进入家园概览页
    expect(await screen.findByRole("heading", { name: "家园概览" })).toBeInTheDocument();
    expect(groupCalls).toBe(0);

    const expectedBody = expect.objectContaining({
      user_name: expect.stringMatching(/^player-\d{8}-\d{6}-[0-9a-f]{8}$/),
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

describe("家园页 /game/:userName/:gameName/home", () => {
  it("每个 stage 一张卡片，卡片内列出该 stage 的 actor", async () => {
    renderApp("/game/webdev/Game1/home");

    expect(await screen.findByRole("button", { name: "角色信息" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "门厅" })).toBeInTheDocument();

    // 断言限定在「场景」分区内：叙事分区也会出现角色名（谁/何地/何事）
    const stages = screen.getByRole("region", { name: "场景" });
    // 门厅卡片 2 个 actor，一楼客房 1 个，二楼卧室无角色
    expect(within(stages).getByText("顾知秋")).toBeInTheDocument();
    expect(within(stages).getByText("无名")).toBeInTheDocument();
    expect(within(stages).getByText("小厮")).toBeInTheDocument();
    expect(within(stages).getAllByText("无角色")).toHaveLength(1);
  });

  it("点「副本」切到副本页（不是浮窗，是换页）", async () => {
    renderApp("/game/webdev/Game1/home");

    fireEvent.click(await screen.findByRole("button", { name: "副本" }));

    expect(await screen.findByRole("heading", { name: "副本" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "队伍名单" })).toBeInTheDocument();
  });

  it("接口失败时展示错误", async () => {
    server.use(
      http.get(api("/api/stages/v1/:userName/:gameName/state"), () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderApp("/game/webdev/Game1/home");

    expect(await screen.findByText(/无法获取家园状态/)).toBeInTheDocument();
  });
});
