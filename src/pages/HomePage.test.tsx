import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import type { Schemas } from "../api/types";
import { homeStagesFixture, sessionMessagesFixture } from "../mocks/fixtures";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import HomePage from "./HomePage";

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/game/webdev/Game1/home"]}>
        <Routes>
          <Route path="/game/:userName/:gameName/home" element={<HomePage />} />
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

const advanceReturns = (jobId: string) =>
  http.post(api("/api/home/advance/v1/"), () =>
    HttpResponse.json({ job_id: jobId, status: "running", message: "ok" }),
  );

const taskWith = (jobId: string, status: string, error: string | null = null) =>
  http.get(api("/api/tasks/v1/status"), () =>
    HttpResponse.json({ tasks: [{ job_id: jobId, status, error }] }),
  );

describe("家园页", () => {
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
        return HttpResponse.json({ job_id: "9", status: "running", message: "ok" });
      }),
      taskWith("9", "completed"),
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

  it("后台任务失败时展示后端错误文本，且不显示完成", async () => {
    server.use(advanceReturns("9"), taskWith("9", "failed", "LLM 调用超时"));

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

  it("叙事面板按 sequence_id 顺序展示会话消息", async () => {
    renderHome();

    const list = await screen.findByRole("list", { name: "会话消息" });
    const items = within(list).getAllByRole("listitem");

    expect(items).toHaveLength(sessionMessagesFixture.length);
    expect(items[0]?.textContent ?? "").toContain("内心活动");
    expect(items[1]?.textContent ?? "").toContain("说");
  });

  it("推进完成后立刻能看到新产生的会话消息（NPC 行动的结果）", async () => {
    let advanced = false;
    const newMessage: Schemas["SessionMessage"] = {
      sequence_id: 1,
      agent_event: {
        type: 1,
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
        return HttpResponse.json({ job_id: "9", status: "running", message: "ok" });
      }),
      taskWith("9", "completed"),
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

    expect(await screen.findByText("角色.顾知秋 忽然开口。")).toBeInTheDocument();
  });
});
