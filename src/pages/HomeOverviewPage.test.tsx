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

/** 拿到已可点击的推进按钮（首屏数据到位前是禁用的）。 */
async function findReadyButton() {
  const button = await screen.findByRole("button", { name: "推进一步" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

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
    fireEvent.click(await findReadyButton());

    expect(await screen.findByText(/推进完成/)).toBeInTheDocument();

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

  it("没有可推进的角色时按钮禁用，并给出提示", async () => {
    server.use(
      http.get(api("/api/stages/v1/:userName/:gameName/state"), () =>
        HttpResponse.json({ mapping: { "场景.空屋": [] } }),
      ),
    );

    renderHome();

    expect(await screen.findByText("当前没有可推进的角色")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "推进一步" })).toBeDisabled();
  });

  it("任务失败时展示后端错误文本，且不显示完成", async () => {
    server.use(advanceReturns(9), taskWith(9, "failed", "LLM 调用超时"));

    renderHome();
    fireEvent.click(await findReadyButton());

    expect(await screen.findByText(/LLM 调用超时/)).toBeInTheDocument();
    expect(screen.queryByText(/推进完成/)).not.toBeInTheDocument();
  });

  it("触发请求失败时展示 HTTP 错误", async () => {
    server.use(
      http.post(api("/api/home/advance/v1/"), () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    renderHome();
    fireEvent.click(await findReadyButton());

    expect(await screen.findByText(/推进失败：API 500/)).toBeInTheDocument();
  });

  it("叙事内联最近 3 条，入口显示「已显示 / 总数」", async () => {
    renderHome();

    const list = await screen.findByRole("list", { name: "会话消息" });
    const items = within(list).getAllByRole("listitem");

    // fixture 共 5 条，内联只取最近 3 条（sequence_id 3、4、5）
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent ?? "").toContain("宣布");
    expect(items[1]?.textContent ?? "").toContain("场景.门厅 → 场景.一楼客房");
    expect(items[2]?.textContent ?? "").toContain("引擎输出的兜底形态");

    const entry = screen.getByRole("button", {
      name: "查看全部事件：当前显示最近 3 条，共 5 条",
    });
    expect(entry).toHaveTextContent("显示 3 / 共 5 条");
  });

  it("点计数按钮打开浮层，浮层内列出全部事件（不截断）", async () => {
    renderHome();

    fireEvent.click(
      await screen.findByRole("button", { name: /查看全部事件：当前显示最近 3 条，共 5 条/ }),
    );

    const dialog = await screen.findByRole("dialog", { name: "全部叙事" });
    const items = within(dialog).getAllByRole("listitem");

    // 浮层里是全部 5 条（内联只有 3 条）
    expect(items).toHaveLength(sessionMessagesFixture.length);
    expect(items[0]?.textContent ?? "").toContain("内心");
    expect(within(dialog).getByText(`共 ${sessionMessagesFixture.length} 条`)).toBeInTheDocument();
  });

  it("浮层可以关闭：关闭按钮、遮罩、ESC 都可以", async () => {
    renderHome();

    const open = async () => {
      fireEvent.click(
        await screen.findByRole("button", { name: /查看全部事件：当前显示最近 3 条，共 5 条/ }),
      );
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

  it("每条消息按「谁 / 何地 / 什么事」展示（stage 来自结构化字段，message 里没有）", async () => {
    renderHome();

    const list = await screen.findByRole("list", { name: "会话消息" });
    const items = within(list).getAllByRole("listitem");
    const announce = items[0]?.textContent ?? "";

    expect(announce).toContain("宣布"); // 标签
    expect(announce).toContain("旁白"); // 谁
    expect(announce).toContain("@ 场景.门厅"); // 何地
    expect(announce).toContain("堂中灯火忽地一暗。"); // 什么事
  });

  it("推进完成后立刻能看到新产生的会话消息（NPC 行动的结果）", async () => {
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
    // 推进前面板是空的
    expect(await screen.findByText(/还没有会话消息/)).toBeInTheDocument();

    fireEvent.click(await findReadyButton());

    expect(await screen.findByText("对 角色.无名 说：忽然开口。")).toBeInTheDocument();
  });

  it("「返回上一级」先二次确认；确认后登出并跳回玩家入口页", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(api("/api/logout/v1/"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ message: "ok" });
      }),
    );

    renderHome();

    // 第一次点击只是展开确认，不该发请求——登出会销毁房间，不可逆
    fireEvent.click(await screen.findByRole("button", { name: "← 返回上一级" }));
    expect(await screen.findByText(/登出会结束当前对局/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "确定登出" }));

    expect(await screen.findByText("玩家入口页占位")).toBeInTheDocument();
    expect(bodies).toEqual([{ user_name: "webdev", game_name: "Game1" }]);
  });

  it("二次确认时选择取消，则退回初始状态且不发登出请求", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(api("/api/logout/v1/"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ message: "ok" });
      }),
    );

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "← 返回上一级" }));
    fireEvent.click(await screen.findByRole("button", { name: "取消" }));

    expect(await screen.findByRole("button", { name: "← 返回上一级" })).toBeInTheDocument();
    expect(screen.queryByText(/登出会结束当前对局/)).not.toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });
});
