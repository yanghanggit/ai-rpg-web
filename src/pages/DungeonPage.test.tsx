import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { addMockRosterMember } from "../mocks/roster";
import DungeonPage from "./DungeonPage";

function renderDungeon() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/game/webdev/Game1/dungeon"]}>
        <Routes>
          <Route path="/game/:userName/:gameName/dungeon" element={<DungeonPage />} />
          <Route path="/game/:userName/:gameName/home" element={<p>家园页占位</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 取某个名字所在那一行的按钮（加入 / 移出）。 */
function rowButton(name: string, label: string): HTMLElement {
  const row = screen.getByText(name).closest("li");
  if (!(row instanceof HTMLElement)) {
    throw new Error(`找不到 ${name} 所在的行`);
  }
  return within(row).getByRole("button", { name: label });
}

describe("副本页 /game/:userName/:gameName/dungeon", () => {
  it("展示当前队伍（玩家）与可加入的同伴", async () => {
    renderDungeon();

    expect(await screen.findByRole("heading", { name: "副本" })).toBeInTheDocument();
    // 名单为空 → 只有玩家自己
    expect(await screen.findByRole("heading", { name: "当前队伍（1 人）" })).toBeInTheDocument();
    expect(screen.getByText("无名")).toBeInTheDocument();
    expect(screen.getByText("玩家")).toBeInTheDocument();
    // 候选 = 持 NPCComponent 的角色
    expect(await screen.findByRole("heading", { name: "可加入的同伴（2）" })).toBeInTheDocument();
    expect(screen.getByText("顾知秋")).toBeInTheDocument();
    expect(screen.getByText("小厮")).toBeInTheDocument();
  });

  it("候选里不含玩家控制角色（玩家的蓝图类型也可能带 NPCComponent）", async () => {
    renderDungeon();

    const heading = await screen.findByRole("heading", { name: "可加入的同伴（2）" });
    const candidateColumn = heading.closest("div");
    if (!(candidateColumn instanceof HTMLElement)) {
      throw new Error("找不到候选栏");
    }
    // 玩家只在「当前队伍」里，不出现在候选里
    expect(within(candidateColumn).queryByText("无名")).not.toBeInTheDocument();
    expect(within(candidateColumn).getByText("顾知秋")).toBeInTheDocument();
  });

  it("加入同伴：调用 roster/add，名单与候选一起刷新", async () => {
    renderDungeon();
    await screen.findByRole("heading", { name: "可加入的同伴（2）" });

    fireEvent.click(rowButton("顾知秋", "加入"));

    expect(await screen.findByRole("heading", { name: "当前队伍（2 人）" })).toBeInTheDocument();
    // 已加入的不再出现在候选里
    expect(await screen.findByRole("heading", { name: "可加入的同伴（1）" })).toBeInTheDocument();
    expect(screen.getByText("小厮")).toBeInTheDocument();
  });

  it("移出同伴：调用 roster/remove，人回到候选列表", async () => {
    addMockRosterMember("角色.顾知秋");
    renderDungeon();
    await screen.findByRole("heading", { name: "当前队伍（2 人）" });

    fireEvent.click(rowButton("顾知秋", "移出"));

    expect(await screen.findByRole("heading", { name: "当前队伍（1 人）" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "可加入的同伴（2）" })).toBeInTheDocument();
  });

  it("加入失败时展示后端返回的原因（带 detail）", async () => {
    server.use(
      http.post(api("/api/home/roster/add/v1/"), () =>
        HttpResponse.json({ detail: "角色 角色.顾知秋 不是 NPC，无法加入队伍" }, { status: 400 }),
      ),
    );
    renderDungeon();
    await screen.findByRole("heading", { name: "可加入的同伴（2）" });

    fireEvent.click(rowButton("顾知秋", "加入"));

    expect(await screen.findByText(/不是 NPC，无法加入队伍/)).toBeInTheDocument();
  });

  it("「← 返回家园」切回家园页", async () => {
    renderDungeon();

    fireEvent.click(await screen.findByRole("button", { name: "← 返回家园" }));

    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
  });
});
