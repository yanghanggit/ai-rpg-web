import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { enterMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { sseResponse } from "../mocks/sseResponse";
import DungeonRoomPage from "./DungeonRoomPage";

function renderRoom() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/game/webdev/Game1/dungeon/room"]}>
        <Routes>
          <Route path="/game/:userName/:gameName/dungeon/room" element={<DungeonRoomPage />} />
          <Route path="/game/:userName/:gameName/home" element={<p>家园页占位</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 让某个 job_id 的任务直接进入终态，避免测试真等 2 秒。 */
const taskWith = (jobId: number, status: string) =>
  http.get(api("/api/tasks/v1/watch/:jobId"), () =>
    sseResponse([JSON.stringify({ job_id: jobId, status, error: null })]),
  );

/** 一直停在 `doing` 的任务流（不结束），用来观察「退出中…」这一态。 */
const stuckTask = (jobId: number) =>
  http.get(api("/api/tasks/v1/watch/:jobId"), () =>
    sseResponse(
      (async function* () {
        yield JSON.stringify({ job_id: jobId, status: "doing", error: null });
        await new Promise(() => {});
      })(),
    ),
  );

/** 覆盖退出接口，让任务 id 固定（mock 自己发号，测试无法预测）。 */
const exitWith = (jobId: number) =>
  http.post(api("/api/dungeon/exit/v1/"), () =>
    HttpResponse.json({ job_id: jobId, message: "mock 退出副本任务已启动" }),
  );

describe("副本房间 · 共同框架", () => {
  it("标题就是房间名（不是「开场」这类类型名）", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    expect(await screen.findByRole("heading", { name: "义庄前院" })).toBeInTheDocument();
  });

  it("顶部动作区只有「副本信息」与「离开副本」（没有返回副本总览的入口）", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    await screen.findByRole("heading", { name: "义庄前院" });
    expect(screen.getByRole("button", { name: "副本信息" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "离开副本" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /返回副本总览/ })).not.toBeInTheDocument();
  });

  it("副本信息：展示副本进度，并标出队伍当前所在的房间", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "副本信息" }));

    const dialog = await screen.findByRole("dialog", { name: "副本信息" });
    // 起点是 rooms[0]（义庄前院）
    expect(within(dialog).getByText("第 1 / 2 间")).toBeInTheDocument();
    expect(within(dialog).getByText("当前所在")).toBeInTheDocument();
    // 房间列表仍然照旧（类型 + 敌人）
    expect(within(dialog).getByText("停柩房")).toBeInTheDocument();
    expect(within(dialog).getByText(/HP 16/)).toBeInTheDocument();
  });

  it("离开副本：任务跑着的时候按钮变「退出中…」并禁用", async () => {
    server.use(exitWith(9), stuckTask(9));
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "离开副本" }));

    expect(await screen.findByRole("button", { name: "退出中…" })).toBeDisabled();
    // 还没结束，人还留在房间页
    expect(screen.getByRole("heading", { name: "义庄前院" })).toBeInTheDocument();
  });

  it("离开副本：任务终态后回家园（后端在任务里已经把人传回去）", async () => {
    server.use(exitWith(9), taskWith(9, "succeeded"));
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "离开副本" }));

    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
  });

  it("没有进行中的房间（后端 404）：原样显示原因，并给出回家园的出口", async () => {
    // 没有 enterMockDungeon：/room 返回 404
    renderRoom();

    expect(await screen.findByText(/当前副本没有进行中的房间/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← 返回家园" }));

    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
  });
});
