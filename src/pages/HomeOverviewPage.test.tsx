import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import type { Schemas } from "../api/types";
import { homeStagesFixture, sessionMessagesFixture } from "../mocks/fixtures";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { sseResponse } from "../mocks/sseResponse";
import HomeOverviewPage from "./HomeOverviewPage";

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/game/webdev/Game1/home"]}>
        <Routes>
          <Route path="/game/:userName/:gameName/home" element={<HomeOverviewPage />} />
          <Route path="/entry" element={<p>玩家入口页占位</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 推进按钮的文案带人数，所以用正则匹配。 */
async function findReadyAdvanceButton() {
  const button = await screen.findByRole("button", { name: /^推进一步/ });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

/** 打开道具管理浮窗：等按钮可用（玩家身份解析完）再点。 */
async function openItemsDialog() {
  const button = await screen.findByRole("button", { name: "道具管理" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  return screen.findByRole("dialog", { name: "道具管理" });
}

const findNarrativeButton = () => screen.findByRole("button", { name: /查看叙事事件/ });

const advanceReturns = (jobId: number) =>
  http.post(api("/api/home/advance/v1/"), () =>
    HttpResponse.json({ job_id: jobId, message: "ok" }),
  );

const taskWith = (jobId: number, status: string, error: string | null = null) =>
  http.get(api("/api/tasks/v1/watch/:jobId"), () =>
    sseResponse([JSON.stringify({ job_id: jobId, status, error })]),
  );

describe("家园概览页", () => {
  it("点「推进一步」：用全部角色触发任务，任务完成后重新拉取家园状态", async () => {
    let stagesCalls = 0;
    const bodies: unknown[] = [];

    server.use(
      http.get(api("/api/stages/v1/:userName/:gameName/state"), () => {
        stagesCalls += 1;
        return HttpResponse.json(homeStagesFixture);
      }),
      http.post(api("/api/home/advance/v1/"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ job_id: 9, message: "ok" });
      }),
      taskWith(9, "succeeded"),
    );

    renderHome();
    fireEvent.click(await findReadyAdvanceButton());

    // 推进完成后按钮恢复可用（不再有「推进完成」文字，成功与否由叙事按钮颜色表达）
    await waitFor(() => expect(screen.getByRole("button", { name: /^推进一步/ })).toBeEnabled());
    expect(screen.queryByText(/推进完成/)).not.toBeInTheDocument();

    expect(bodies).toEqual([
      {
        user_name: "webdev",
        game_name: "Game1",
        // 全部场景的全部角色，跨场景去重且保序（与 TUI cmd_advance 口径一致）
        actors: ["角色.顾知秋", "角色.无名", "角色.小厮"],
      },
    ]);

    // 任务完成后家园状态被重新拉取（首屏 1 次 + 失效后至少 1 次）
    await waitFor(() => expect(stagesCalls).toBeGreaterThanOrEqual(2));
  });

  it("人数直接写在推进按钮上，页面上没有额外的解释文案", async () => {
    renderHome();

    expect(await screen.findByRole("button", { name: "推进一步 · 3 个角色" })).toBeInTheDocument();
    expect(screen.queryByText(/需要等待/)).not.toBeInTheDocument();
    expect(screen.queryByText(/对全部/)).not.toBeInTheDocument();
  });

  it("没有可推进的角色时按钮禁用，人数显示为 0", async () => {
    server.use(
      http.get(api("/api/stages/v1/:userName/:gameName/state"), () =>
        HttpResponse.json({ mapping: { "场景.空屋": [] } }),
      ),
    );

    renderHome();

    expect(await screen.findByRole("button", { name: "推进一步 · 0 个角色" })).toBeDisabled();
  });

  it("任务失败时展示后端错误文本，且叙事按钮不变绿", async () => {
    server.use(advanceReturns(9), taskWith(9, "failed", "LLM 调用超时"));

    renderHome();
    fireEvent.click(await findReadyAdvanceButton());

    expect(await screen.findByText(/LLM 调用超时/)).toBeInTheDocument();
    // 失败不是「有新内容」，不该亮绿
    expect(await findNarrativeButton()).not.toHaveClass("count-button--unread");
  });

  it("触发请求失败时展示 HTTP 错误", async () => {
    server.use(
      http.post(api("/api/home/advance/v1/"), () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    renderHome();
    fireEvent.click(await findReadyAdvanceButton());

    expect(await screen.findByText(/推进失败：API 500/)).toBeInTheDocument();
  });

  it("叙事不在页面上展开，只留一个通知按钮", async () => {
    renderHome();

    await findNarrativeButton();
    // 首屏 5 条历史全部计为「已看」，所以是 5 / 5 而不是 0 / 5
    await waitFor(() => expect(findNarrativeButtonValue()).toBe("叙事 5 / 5"));

    // 页面上没有内联的消息列表
    expect(screen.queryByRole("list", { name: "会话消息" })).not.toBeInTheDocument();
  });

  it("点通知按钮打开浮层，浮层内列出全部事件", async () => {
    renderHome();

    fireEvent.click(await findNarrativeButton());

    const dialog = await screen.findByRole("dialog", { name: "全部叙事" });
    const items = within(dialog).getAllByRole("listitem");

    expect(items).toHaveLength(sessionMessagesFixture.length);
    expect(items[1]?.textContent ?? "").toContain("对 无名 说：");
    expect(within(dialog).getByText(`共 ${sessionMessagesFixture.length} 条`)).toBeInTheDocument();
  });

  it("浮层可以关闭：关闭按钮、遮罩、ESC 都可以", async () => {
    renderHome();

    const open = async () => {
      fireEvent.click(await findNarrativeButton());
      return screen.findByRole("dialog", { name: "全部叙事" });
    };

    await open();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "全部叙事" })).not.toBeInTheDocument();

    await open();
    fireEvent.click(screen.getByRole("button", { name: "关闭浮层" }));
    expect(screen.queryByRole("dialog", { name: "全部叙事" })).not.toBeInTheDocument();

    await open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "全部叙事" })).not.toBeInTheDocument();
  });

  it("推进产生新事件后，叙事按钮变绿（用颜色代替「推进完成」文案）", async () => {
    let advanced = false;
    const newMessage: Schemas["SessionMessage"] = {
      sequence_id: 1,
      agent_event: {
        type: "speak",
        message: "角色.顾知秋 忽然开口。",
        actor: "角色.顾知秋",
        stage: "场景.门厅",
        target: "角色.无名",
        content: "忽然开口。",
      },
    };

    server.use(
      http.post(api("/api/home/advance/v1/"), () => {
        advanced = true;
        return HttpResponse.json({ job_id: 9, message: "ok" });
      }),
      taskWith(9, "succeeded"),
      http.get(api("/api/session_messages/v1/:userName/:gameName/since"), ({ request }) => {
        const since = Number(new URL(request.url).searchParams.get("last_sequence_id") ?? 0);
        const all = advanced ? [newMessage] : [];
        return HttpResponse.json({
          session_messages: all.filter((message) => message.sequence_id > since),
        });
      }),
    );

    renderHome();
    // 开局没有事件：0 / 0，没有未读
    expect(await findNarrativeButton()).toHaveTextContent("叙事 0 / 0");
    expect(await findNarrativeButton()).not.toHaveClass("count-button--unread");

    fireEvent.click(await findReadyAdvanceButton());

    // 新事件到达：0 / 1，右大于左 + 高亮
    await waitFor(() => expect(findNarrativeButtonValue()).toBe("叙事 0 / 1"));
    expect(await findNarrativeButton()).toHaveClass("count-button--unread");

    // 打开浮层即视为已读
    fireEvent.click(await findNarrativeButton());
    await screen.findByRole("dialog", { name: "全部叙事" });
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    await waitFor(() => expect(findNarrativeButtonValue()).toBe("叙事 1 / 1"));
    expect(await findNarrativeButton()).not.toHaveClass("count-button--unread");
  });

  it("「返回上一级」用浮窗确认；确认后登出并跳回玩家入口页", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(api("/api/logout/v1/"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ message: "ok" });
      }),
    );

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "← 返回上一级" }));

    // 第一次点击只是打开确认浮窗，不该发请求——登出会销毁房间，不可逆
    const dialog = await screen.findByRole("dialog", { name: "确认登出" });
    expect(dialog).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "确定登出" }));

    expect(await screen.findByText("玩家入口页占位")).toBeInTheDocument();
    expect(bodies).toEqual([{ user_name: "webdev", game_name: "Game1" }]);
  });

  it("登出确认浮窗可以取消，且不发请求", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(api("/api/logout/v1/"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ message: "ok" });
      }),
    );

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "← 返回上一级" }));
    const dialog = await screen.findByRole("dialog", { name: "确认登出" });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog", { name: "确认登出" })).not.toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it("标出玩家当前所在场景，并禁止切换到当前场景", async () => {
    renderHome();

    // 默认玩家角色「角色.无名」在「场景.门厅」
    await screen.findByRole("heading", { name: "门厅" });
    await waitFor(() =>
      expect(within(cardOf("门厅")).getByRole("button", { name: "当前所在" })).toBeDisabled(),
    );
    expect(cardOf("门厅")).toHaveClass("card--current");

    // 其它场景没有高亮，按钮可点
    const otherSwitches = screen.getAllByRole("button", { name: "切换到此场景" });
    expect(otherSwitches).toHaveLength(2);
    for (const button of otherSwitches) {
      expect(button).toBeEnabled();
    }
    expect(cardOf("一楼客房")).not.toHaveClass("card--current");
  });

  it("切换场景：等任务完成后刷新状态与叙事，并把「当前所在」移过去", async () => {
    // 默认 switch_stage handler 会改 mock 场景表并追一条叙事；
    // 只把任务监听替换成立即成功，避免测试等 2 秒。
    server.use(taskWith(1, "succeeded"));

    renderHome();

    await screen.findByRole("heading", { name: "门厅" });
    await waitFor(() =>
      expect(within(cardOf("门厅")).getByRole("button", { name: "当前所在" })).toBeDisabled(),
    );

    fireEvent.click(within(cardOf("一楼客房")).getByRole("button", { name: "切换到此场景" }));

    // 切换完成后：高亮与「当前所在」移到一楼客房
    await waitFor(() =>
      expect(within(cardOf("一楼客房")).getByRole("button", { name: "当前所在" })).toBeDisabled(),
    );
    expect(cardOf("一楼客房")).toHaveClass("card--current");
    expect(cardOf("门厅")).not.toHaveClass("card--current");

    // 切换产生 trans_stage 叙事 → 叙事按钮出现未读
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /查看叙事事件/ })).toHaveClass(
        "count-button--unread",
      ),
    );
  });

  it("切换请求体使用原始场景名（不是显示名）", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(api("/api/home/player/switch_stage/v1/"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ job_id: 1, message: "ok" });
      }),
      taskWith(1, "succeeded"),
    );

    renderHome();

    await screen.findByRole("heading", { name: "二楼卧室" });
    fireEvent.click(within(cardOf("二楼卧室")).getByRole("button", { name: "切换到此场景" }));

    await waitFor(() =>
      expect(bodies).toEqual([
        { user_name: "webdev", game_name: "Game1", stage_name: "场景.二楼卧室" },
      ]),
    );
  });

  it("切换失败时展示后端错误，且当前场景不变", async () => {
    server.use(
      http.post(api("/api/home/player/switch_stage/v1/"), () =>
        HttpResponse.json({ detail: "目标场景不存在" }, { status: 400 }),
      ),
    );

    renderHome();

    await screen.findByRole("heading", { name: "一楼客房" });
    await waitFor(() =>
      expect(within(cardOf("门厅")).getByRole("button", { name: "当前所在" })).toBeDisabled(),
    );

    fireEvent.click(within(cardOf("一楼客房")).getByRole("button", { name: "切换到此场景" }));

    expect(await screen.findByText(/切换失败：API 400/)).toBeInTheDocument();
    expect(within(cardOf("门厅")).getByRole("button", { name: "当前所在" })).toBeDisabled();
  });

  it("切换进行中时，推进与其它切换按钮一起禁用", async () => {
    // 不覆盖 watch：mock 任务约 2 秒后完成，足够观察进行中状态
    renderHome();

    await screen.findByRole("heading", { name: "一楼客房" });
    await waitFor(() =>
      expect(within(cardOf("门厅")).getByRole("button", { name: "当前所在" })).toBeDisabled(),
    );

    fireEvent.click(within(cardOf("一楼客房")).getByRole("button", { name: "切换到此场景" }));

    expect(await screen.findByRole("button", { name: "切换中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^推进一步/ })).toBeDisabled();
    expect(within(cardOf("二楼卧室")).getByRole("button", { name: "切换到此场景" })).toBeDisabled();
  });

  it("无法解析玩家角色时给出提示，且不误标当前场景", async () => {
    server.use(
      http.get(api("/api/entities/v1/:userName/:gameName/group"), () =>
        HttpResponse.json({ detail: "没有房间" }, { status: 404 }),
      ),
    );

    renderHome();

    expect(await screen.findByText(/无法识别玩家角色/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "当前所在" })).not.toBeInTheDocument();
  });

  it("点「角色信息」打开浮窗，展示玩家组件的必要信息", async () => {
    renderHome();

    const open = await screen.findByRole("button", { name: "角色信息" });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);

    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    expect(await within(dialog).findByText("webdev")).toBeInTheDocument();
    expect(within(dialog).getByText("00000000-0000-0000-0000-0000000000aa")).toBeInTheDocument();
    expect(within(dialog).getByText("12 / 15")).toBeInTheDocument();
    expect(within(dialog).getByText(/缠麻短刃/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "角色信息" })).not.toBeInTheDocument();
  });

  it("点「蓝图信息」打开浮窗，只展示蓝图名字/战役设定/世界系统", async () => {
    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "蓝图信息" }));

    const dialog = await screen.findByRole("dialog", { name: "蓝图信息" });
    expect(await within(dialog).findByText("Game1")).toBeInTheDocument();
    expect(within(dialog).getByText(/架空的、融合狩猎玩法/)).toBeInTheDocument();
    expect(within(dialog).getByText("玩家行动审计系统")).toBeInTheDocument();
    expect(within(dialog).getByText("副本生成系统")).toBeInTheDocument();

    // 进入游戏后再看无意义的场景/角色、背包与仓库物品都不展示
    expect(within(dialog).queryByText(/旧麻绳|缠麻短刃|吗啡针剂/)).not.toBeInTheDocument();
  });

  it("点场景卡片里的 NPC chip：打开该 NPC 的角色信息，且不显示「玩家名」", async () => {
    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "顾知秋" }));

    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    expect(
      await within(dialog).findByText("00000000-0000-0000-0000-0000000000bb"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("18 / 18")).toBeInTheDocument();
    // NPC 没有 PlayerComponent，不显示玩家名这一行
    expect(within(dialog).queryByText("玩家名")).not.toBeInTheDocument();
    expect(within(dialog).getAllByText("顾知秋").length).toBeGreaterThan(0);
  });

  it("点玩家 chip 与点工具栏「角色信息」等价（都显示玩家名）", async () => {
    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "无名" }));

    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    expect(await within(dialog).findByText("webdev")).toBeInTheDocument();
    expect(within(dialog).getByText("玩家名")).toBeInTheDocument();
  });

  it("角色信息里可脱下时装：等任务完成后不再显示穿着中", async () => {
    server.use(taskWith(1, "succeeded"));

    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "顾知秋" }));
    const dialog = await screen.findByRole("dialog", { name: "角色信息" });

    expect(await within(dialog).findByText(/朱砂袍/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "脱下时装" }));

    await waitFor(() => expect(within(dialog).getByText("（未穿戴时装）")).toBeInTheDocument());
    expect(within(dialog).getByRole("button", { name: "穿时装" })).toBeInTheDocument();
    expect(within(dialog).queryByText(/朱砂袍/)).not.toBeInTheDocument();
  });

  it("穿时装：二级浮窗列出储物箱时装，点一件即穿上", async () => {
    server.use(taskWith(1, "succeeded"));

    renderHome();
    // 小厮未穿时装
    fireEvent.click(await screen.findByRole("button", { name: "小厮" }));
    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    expect(await within(dialog).findByText("（未穿戴时装）")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "穿时装" }));

    const picker = await screen.findByRole("dialog", { name: "选择时装" });
    fireEvent.click(await within(picker).findByRole("button", { name: /青衫/ }));

    // 二级浮窗关闭，角色信息里出现新时装
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "选择时装" })).not.toBeInTheDocument(),
    );
    expect(await within(dialog).findByText(/青衫/)).toBeInTheDocument();
  });

  it("点「道具管理」打开浮窗，展示背包、储物箱与穿戴中时装", async () => {
    renderHome();

    const dialog = await openItemsDialog();

    // 背包：装备 + 消耗品
    expect(await within(dialog).findByText("缠麻短刃")).toBeInTheDocument();
    expect(within(dialog).getByText("吗啡针剂 ×2")).toBeInTheDocument();
    // 储物箱：材料（×2）、装备、时装各一
    expect(within(dialog).getAllByText("旧麻绳 ×3").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("铁刀")).toBeInTheDocument();
    expect(within(dialog).getByText("青衫")).toBeInTheDocument();
    // 穿戴中的时装合入储物箱顶部，只读展示（顾知秋 · 朱砂袍）
    expect(within(dialog).getByText("穿戴中（只读）")).toBeInTheDocument();
    expect(within(dialog).getByText("顾知秋 · 朱砂袍")).toBeInTheDocument();
    expect(within(dialog).getByText(/绯色暗纹的道袍/)).toBeInTheDocument();

    // 时装不可移入背包：储物箱里的时装没勾选框，背包里的每件都有
    expect(within(dialog).queryByLabelText("选择 时装.青衫")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("选择 装备.缠麻短刃")).toBeInTheDocument();
  });

  it("勾选背包道具后可批量移入储物箱", async () => {
    renderHome();
    const dialog = await openItemsDialog();

    fireEvent.click(await within(dialog).findByLabelText("选择 装备.缠麻短刃"));
    fireEvent.click(within(dialog).getByLabelText("选择 消耗品.吗啡针剂"));
    fireEvent.click(within(dialog).getByRole("button", { name: "移入储物箱（2）" }));

    // 移动后：背包清空，两件道具出现在储物箱
    await waitFor(() => expect(within(dialog).getByText("（空）")).toBeInTheDocument());
    expect(within(dialog).getByText("缠麻短刃")).toBeInTheDocument();
    expect(within(dialog).getByText("吗啡针剂 ×2")).toBeInTheDocument();
  });

  it("勾选材料后经二次确认合成消耗品：默认填满用量，确认后刷新道具与叙事", async () => {
    // 默认 craft handler 会消耗材料 + 追一条叙事，再返回 job_id；只把任务监听换成立即成功
    server.use(taskWith(1, "succeeded"));

    renderHome();
    const dialog = await openItemsDialog();

    // 勾选两种材料（旧麻绳 ×3、符纸残片 ×2）
    fireEvent.click(await within(dialog).findByLabelText("选择 材料.旧麻绳"));
    fireEvent.click(within(dialog).getByLabelText("选择 材料.符纸残片"));

    // 点工坊按钮：叠出第二层确认浮窗，用量默认填满库存
    fireEvent.click(within(dialog).getByRole("button", { name: "合成消耗品" }));
    const confirm = await screen.findByRole("dialog", { name: "合成消耗品" });
    expect(within(confirm).getByLabelText("材料.旧麻绳 用量")).toHaveValue(3);
    expect(within(confirm).getByLabelText("材料.符纸残片 用量")).toHaveValue(2);

    // 改低旧麻绳用量后确认
    fireEvent.change(within(confirm).getByLabelText("材料.旧麻绳 用量"), {
      target: { value: "2" },
    });
    fireEvent.click(within(confirm).getByRole("button", { name: "确认" }));

    // 确认后回到道具管理；任务完成后：产物入箱，旧麻绳 3→1（显为「旧麻绳」），符纸残片用尽
    expect(await within(dialog).findByText("回气散")).toBeInTheDocument();
    expect(within(dialog).getByText("旧麻绳")).toBeInTheDocument();
    expect(within(dialog).queryByText("旧麻绳 ×3")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/符纸残片/)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "合成消耗品" })).not.toBeInTheDocument();

    // 合成产物通过叙事通知：关闭浮窗后叙事按钮出现未读
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /查看叙事事件/ })).toHaveClass(
        "count-button--unread",
      ),
    );
  });
});

/** 按显示名找到场景卡片（article），把断言限定在单张卡内。 */
function cardOf(stageDisplay: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: stageDisplay });
  const card = heading.closest("article");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`找不到场景卡片：${stageDisplay}`);
  }
  return card;
}

/** 读取通知按钮的当前文案（waitFor 里用，避免重复查询）。 */
function findNarrativeButtonValue(): string {
  return screen.getByRole("button", { name: /查看叙事事件/ }).textContent ?? "";
}
