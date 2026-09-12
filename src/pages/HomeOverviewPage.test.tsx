import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import type { Schemas } from "../api/types";
import { homeStagesFixture, sessionMessagesFixture } from "../mocks/fixtures";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
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

const findNarrativeButton = () => screen.findByRole("button", { name: /查看叙事事件/ });

const advanceReturns = (jobId: number) =>
  http.post(api("/api/home/advance/v1/"), () =>
    HttpResponse.json({ job_id: jobId, message: "ok" }),
  );

const taskWith = (jobId: number, status: string, error: string | null = null) =>
  http.get(api("/api/tasks/v1/status"), () =>
    HttpResponse.json({ tasks: [{ job_id: jobId, status, error }] }),
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
});

/** 读取通知按钮的当前文案（waitFor 里用，避免重复查询）。 */
function findNarrativeButtonValue(): string {
  return screen.getByRole("button", { name: /查看叙事事件/ }).textContent ?? "";
}
