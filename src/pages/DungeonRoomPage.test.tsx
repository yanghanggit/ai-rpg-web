import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { enterMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { addMockRosterMember } from "../mocks/roster";
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

/**
 * 让**任意** job_id 的等待立刻成功。
 *
 * 不能改成覆盖 POST 端点：mock 的状态变化发生在 handler 里（初始化、卡池、挑卡），
 * 覆盖掉就什么都没发生。所以只把「等任务」这一步压成瞬时，其余照旧。
 */
const instantTasks = () =>
  http.get(api("/api/tasks/v1/watch/:jobId"), ({ params }) =>
    sseResponse([
      JSON.stringify({ job_id: Number(params.jobId), status: "succeeded", error: null }),
    ]),
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

/** 走完「初始化 → 生成卡池」，进入可挑卡的状态。 */
async function prepareCardPool() {
  fireEvent.click(await screen.findByRole("button", { name: "初始化开场" }));
  fireEvent.click(await screen.findByRole("button", { name: "生成卡池" }));
  // 两个动作都是任务，等候选卡真的出来再交给用例
  await screen.findAllByRole("button", { name: /^挑选 / });
}

describe("副本房间 · 开场房间", () => {
  it("标题是房间名，正文给场景环境叙述；未初始化时只放「初始化开场」", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    expect(await screen.findByRole("heading", { name: "义庄前院" })).toBeInTheDocument();
    // 场景环境（EnvironmentComponent.narrative）——房间的正文开场白
    expect(await screen.findByText(/义庄前院 的环境叙述/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "初始化开场" })).toBeInTheDocument();
    // 卡池依赖初始化，所以这时不给这个按钮
    expect(screen.queryByRole("button", { name: "生成卡池" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入下一关" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "叙事" })).toBeInTheDocument();
  });

  it("初始化 → 生成卡池：每个成员出现 3 张候选卡（各带「挑选」）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    await prepareCardPool();

    expect(await screen.findByRole("button", { name: "挑选 火折子" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^挑选 / })).toHaveLength(3);
    expect(screen.getByText("卡池 3 选 1，挑走一张后其余作废")).toBeInTheDocument();
    // 生成后卡池按钮收起（同一时间只给「当前该做的那一步」）
    expect(screen.queryByRole("button", { name: "生成卡池" })).not.toBeInTheDocument();
  });

  it("挑卡：挑走的那张进牌组，整个卡池清空（其余作废）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await prepareCardPool();
    expect(await screen.findByText("牌组 3 张")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "挑选 火折子" }));

    // 牌组 +1，卡池整份消失（连未被选中的那两张也没了）
    expect(await screen.findByText("牌组 4 张")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^挑选 / })).not.toBeInTheDocument();
    // 全队都没卡池了：界面回到「可以再生成一轮」——这是后端自己的语义（守卫只看有没有人还持有卡池）
    expect(await screen.findByRole("button", { name: "生成卡池" })).toBeInTheDocument();
  });

  it("挑卡是按成员各自算的：给顾知秋挑卡不影响玩家的卡池", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.顾知秋");
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await prepareCardPool();

    // 两个人各 3 张候选
    expect(await screen.findAllByRole("button", { name: /^挑选 / })).toHaveLength(6);

    const qiuzhiSection = screen.getByRole("heading", { name: "顾知秋" }).closest("section");
    if (!(qiuzhiSection instanceof HTMLElement)) {
      throw new Error("找不到顾知秋那一段");
    }
    fireEvent.click(within(qiuzhiSection).getByRole("button", { name: "挑选 镇棺符" }));

    // 顾知秋的卡池清空，玩家那边还是 3 张
    expect(await within(qiuzhiSection).findByText("（已挑过，卡池已清空）")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^挑选 / })).toHaveLength(3);
  });

  it("牌组浮窗：点开看这个成员现在有哪些牌", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "查看牌组" }));

    const dialog = await screen.findByRole("dialog", { name: "牌组" });
    expect(within(dialog).getByText("无名 · 共 3 张")).toBeInTheDocument();
    expect(within(dialog).getByText("剖棺")).toBeInTheDocument();
    expect(within(dialog).getByText("常驻厌胜")).toBeInTheDocument();
    // 不可出牌的卡在卡面上有标记
    expect(within(dialog).getByText("不可出牌")).toBeInTheDocument();
  });

  it("叙事入口：打开浮层看这一局的事件", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "叙事" }));

    expect(await screen.findByRole("dialog", { name: "全部叙事" })).toBeInTheDocument();
  });

  it("进入下一关：确认框列出下一间与准备状态，确认后落到战斗房间", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "进入下一关" }));

    const dialog = await screen.findByRole("dialog", { name: "进入下一关" });
    // 下一间是战斗房间，名字与类型都摊开
    expect(within(dialog).getByText("停柩房")).toBeInTheDocument();
    expect(within(dialog).getByText("战斗")).toBeInTheDocument();
    // 准备状态只提示、不阻止
    expect(within(dialog).getByText(/初始化 未完成/)).toBeInTheDocument();
    expect(within(dialog).getByText(/卡池 暂无候选/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "进入下一关" }));

    // 副本推进到战斗房间：开场房间那一屏被换掉
    expect(await screen.findByText("战斗房间界面尚未实现。")).toBeInTheDocument();
  });

  it("进入下一关失败时把后端原因显示在确认框里", async () => {
    server.use(
      http.post(api("/api/dungeon/progress/advance_stage/v1/"), () =>
        HttpResponse.json({ detail: "副本已全部通关，请返回营地" }, { status: 409 }),
      ),
    );
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "进入下一关" }));
    const dialog = await screen.findByRole("dialog", { name: "进入下一关" });
    fireEvent.click(within(dialog).getByRole("button", { name: "进入下一关" }));

    expect(await within(dialog).findByText(/副本已全部通关/)).toBeInTheDocument();
  });
});
