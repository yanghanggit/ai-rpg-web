import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { enterMockDungeon, generateMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { readMockActorEntity } from "../mocks/items";
import { server } from "../mocks/node";
import { addMockRosterMember } from "../mocks/roster";
import { sseResponse } from "../mocks/sseResponse";
import DungeonOverviewPage from "./DungeonOverviewPage";

function renderDungeon() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/game/webdev/Game1/dungeon"]}>
        <Routes>
          <Route path="/game/:userName/:gameName/dungeon" element={<DungeonOverviewPage />} />
          <Route path="/game/:userName/:gameName/dungeon/map" element={<p>副本地图页占位</p>} />
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

/** 让某个 job_id 的任务直接进入终态，避免测试真等 2 秒。 */
const taskWith = (jobId: number, status: string) =>
  http.get(api("/api/tasks/v1/watch/:jobId"), () =>
    sseResponse([JSON.stringify({ job_id: jobId, status, error: null })]),
  );

describe("副本总览 · 可用副本（静态模型数据）", () => {
  it("展示副本列表：名字、房间数与整体设定", async () => {
    renderDungeon();

    expect(await screen.findByText("荒村义庄")).toBeInTheDocument();
    expect(screen.getByText("2 个房间")).toBeInTheDocument();
    expect(
      screen.getByText("（mock）荒村外的旧义庄：停柩不腐，夜里似有人影走动。"),
    ).toBeInTheDocument();
  });

  it("点副本卡片：浮窗展示房间、房间类型与敌人属性", async () => {
    renderDungeon();

    fireEvent.click(await screen.findByRole("button", { name: "查看副本：荒村义庄" }));

    const dialog = await screen.findByRole("dialog", { name: "副本信息" });
    expect(within(dialog).getByText("义庄前院")).toBeInTheDocument();
    expect(within(dialog).getByText("开场")).toBeInTheDocument();
    expect(within(dialog).getByText("停柩房")).toBeInTheDocument();
    expect(within(dialog).getByText("战斗")).toBeInTheDocument();
    // 战斗房间列出敌人的 HP / ATK / DEF
    expect(within(dialog).getByText("棺中殭尸")).toBeInTheDocument();
    expect(within(dialog).getByText(/HP 16/)).toBeInTheDocument();
    // 开场房间没有敌人（那一行只有名字与类型徐标，不列敌人）
    const openingRow = within(dialog).getByText("义庄前院").closest("li");
    expect(openingRow).not.toHaveTextContent("HP");
  });

  it("生成新副本：触发任务，完成后列表出现新副本", async () => {
    server.use(
      http.post(api("/api/home/generate_dungeon/v1/"), () => {
        generateMockDungeon();
        return HttpResponse.json({ job_id: 7, message: "mock 副本生成任务已启动" });
      }),
      taskWith(7, "succeeded"),
    );
    renderDungeon();

    await screen.findByText("荒村义庄");
    fireEvent.click(screen.getByRole("button", { name: "生成新副本" }));

    expect(await screen.findByText("试炼之地1")).toBeInTheDocument();
  });
});

describe("副本总览 · 队伍名单", () => {
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

  it("点角色名：打开角色信息浮窗（与家园页同一流程）", async () => {
    renderDungeon();

    // 候选里的 NPC
    fireEvent.click(await screen.findByRole("button", { name: "查看角色：顾知秋" }));
    const npcDialog = await screen.findByRole("dialog", { name: "角色信息" });
    expect(
      await within(npcDialog).findByText("00000000-0000-0000-0000-0000000000bb"),
    ).toBeInTheDocument();
    fireEvent.click(within(npcDialog).getByRole("button", { name: "关闭" }));

    // 当前队伍里的玩家角色
    fireEvent.click(await screen.findByRole("button", { name: "查看角色：无名" }));
    const playerDialog = await screen.findByRole("dialog", { name: "角色信息" });
    expect(
      await within(playerDialog).findByText("00000000-0000-0000-0000-0000000000aa"),
    ).toBeInTheDocument();
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

describe("副本总览 · 道具管理（出征前整理行装）", () => {
  it("与家园页同一个浮窗：可以移道具，但**没有**工坊合成入口", async () => {
    renderDungeon();

    // 玩家名解析出来前按钮是禁用的（与家园页一致），先等它可用再点
    const openButton = await screen.findByRole("button", { name: "道具管理" });
    await waitFor(() => expect(openButton).toBeEnabled());
    fireEvent.click(openButton);

    const dialog = await screen.findByRole("dialog", { name: "道具管理" });
    // 背包 / 储物箱 / 穿戴中时装都在
    expect(await within(dialog).findByText("缠麻短刃")).toBeInTheDocument();
    expect(within(dialog).getByText("穿戴中（只读）")).toBeInTheDocument();
    expect(within(dialog).getByText("背包 2 · 储物箱 4")).toBeInTheDocument();

    // 移动可用：勾选背包道具 → 移入储物箱
    fireEvent.click(within(dialog).getByLabelText("选择 装备.缠麻短刃"));
    fireEvent.click(within(dialog).getByRole("button", { name: "移入储物箱（1）" }));
    expect(await within(dialog).findByText("背包 1 · 储物箱 5")).toBeInTheDocument();

    // 三个工坊按钮一个都不在（合成必须在家园做）
    expect(within(dialog).queryByRole("button", { name: "合成消耗品" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "制造装备" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "制作时装" })).not.toBeInTheDocument();
  });
});

describe("副本总览 · 进入副本（最终确认）", () => {
  it("确认浮窗展示队伍与背包，确认后发起进入并切到**副本地图**（房间之间那一站）", async () => {
    addMockRosterMember("角色.顾知秋");
    server.use(
      http.post(api("/api/home/enter_dungeon/v1/"), async ({ request }) => {
        expect(await request.json()).toEqual({
          user_name: "webdev",
          game_name: "Game1",
          dungeon_name: "副本.荒村义庄",
        });
        return HttpResponse.json({ message: "mock 已进入副本" });
      }),
    );
    renderDungeon();

    fireEvent.click(await screen.findByRole("button", { name: "进入副本：荒村义庄" }));

    const dialog = await screen.findByRole("dialog", { name: "进入副本" });
    // 起点取自 rooms[0]（不是「第一个开场房间」）
    expect(within(dialog).getByText("义庄前院")).toBeInTheDocument();
    expect(within(dialog).getByText("开场")).toBeInTheDocument();

    // 队伍：玩家本人 + 名单里的同伴，各带战斗属性
    expect(
      await within(dialog).findByRole("heading", { name: "队伍（2 人）" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("无名")).toBeInTheDocument();
    expect(within(dialog).getByText("（玩家）")).toBeInTheDocument();
    expect(within(dialog).getByText(/HP 18\/18/)).toBeInTheDocument();

    // 背包：与「道具管理」同一套道具行（名字 ×N + 中文类型 chip）
    expect(within(dialog).getByRole("heading", { name: "背包（2 件）" })).toBeInTheDocument();
    expect(within(dialog).getByText("缠麻短刃")).toBeInTheDocument();
    expect(within(dialog).getByText("吗啡针剂 ×2")).toBeInTheDocument();
    expect(within(dialog).getByText("消耗品")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "确认进入" }));

    expect(await screen.findByText("副本地图页占位")).toBeInTheDocument();
  });

  it("队伍里有已死亡的角色：确认按钮禁用并说明原因（后端会直接 500）", async () => {
    addMockRosterMember("角色.顾知秋");
    // 只覆盖一件事：给名单里的同伴挂上 DeathComponent
    server.use(
      http.get(api("/api/entities/v1/:userName/:gameName/details"), ({ request }) => {
        const names = new URL(request.url).searchParams.getAll("entities");
        const entities = names.flatMap((name) => {
          const entity = readMockActorEntity(name);
          if (entity === null) {
            return [];
          }
          if (name === "角色.顾知秋") {
            entity.components.push({ name: "DeathComponent", data: { name } });
          }
          return [entity];
        });
        return HttpResponse.json({ entities });
      }),
    );
    renderDungeon();

    fireEvent.click(await screen.findByRole("button", { name: "进入副本：荒村义庄" }));
    const dialog = await screen.findByRole("dialog", { name: "进入副本" });

    expect(await within(dialog).findByText("已死亡，无法参战")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "确认进入" })).toBeDisabled();
  });

  it("已有副本进行中：进入按钮禁用，并给出回到副本的入口", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderDungeon();

    expect(await screen.findByRole("button", { name: "进入副本：荒村义庄" })).toBeDisabled();
    expect(await screen.findByRole("button", { name: "回到副本：荒村义庄" })).toBeInTheDocument();
    expect(screen.getByText(/退出副本后才能进入新的副本/)).toBeInTheDocument();
  });
});
