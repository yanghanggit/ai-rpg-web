import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { enterMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { addMockRosterMember } from "../mocks/roster";
import { sseResponse } from "../mocks/sseResponse";
import DungeonRoomPage from "./DungeonRoomPage";

/** 开场房间的标题：副本名 (当前/总数) 房间名。 */
const OPENING_HEADING = "荒村义庄 (1/2) 义庄前院";

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

/**
 * 让**任意** job_id 的等待立刻成功。
 *
 * 不能改成覆盖 POST 端点：mock 的状态变化发生在 handler 里（初始化、奖励、挑卡），
 * 覆盖掉就什么都没发生。所以只把「等任务」这一步压成瞬时，其余照旧。
 *
 * 进入开场房间会自动初始化，所以几乎每个开场用例都要它——否则要真等 2 秒。
 */
const instantTasks = () =>
  http.get(api("/api/tasks/v1/watch/:jobId"), ({ params }) =>
    sseResponse([
      JSON.stringify({ job_id: Number(params.jobId), status: "succeeded", error: null }),
    ]),
  );

/** 覆盖退出接口，让任务 id 固定（mock 自己发号，测试无法预测）。 */
const exitWith = (jobId: number) =>
  http.post(api("/api/dungeon/exit/v1/"), () =>
    HttpResponse.json({ job_id: jobId, message: "mock 退出副本任务已启动" }),
  );

/**
 * 按 job_id 分派任务终态：指定的 id 可停在 `doing`，其余立即成功。
 *
 * 退出用例要「初始化先成功、退出一直跑」，单一的 `instantTasks` / 全 `doing` 都做不到。
 */
const tasksWithStuck = (stuckJobId: number) =>
  http.get(api("/api/tasks/v1/watch/:jobId"), ({ params }) => {
    const jobId = Number(params.jobId);
    if (jobId === stuckJobId) {
      return sseResponse(
        (async function* () {
          yield JSON.stringify({ job_id: jobId, status: "doing", error: null });
          await new Promise(() => {});
        })(),
      );
    }
    return sseResponse([JSON.stringify({ job_id: jobId, status: "succeeded", error: null })]);
  });

/** 覆盖开场初始化接口，让自动初始化直接失败（用来测重试与守卫）。 */
const failingInit = (spy: () => void) =>
  http.post(api("/api/dungeon/opening/init/v1/"), () => {
    spy();
    return HttpResponse.json({ detail: "mock 初始化失败" }, { status: 500 });
  });

/** 进入开场房间会自动初始化；等它完成（`生成奖励` 出现即代表 `initialized=true`）。 */
const waitForInit = () => screen.findByRole("button", { name: "生成奖励" });

/** 走完「（自动）初始化 → 生成奖励」，进入可挑卡的状态。 */
async function prepareSpoils() {
  fireEvent.click(await waitForInit());
  // 生成奖励也是任务，等候选卡真的出来再交给用例
  await screen.findAllByRole("button", { name: /^挑选 / });
}

describe("副本房间 · 共同框架", () => {
  it("标题 = 副本名 (当前/总数) 房间名（不是「开场」这类类型名）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    expect(await screen.findByRole("heading", { name: OPENING_HEADING })).toBeInTheDocument();
    // 只有房间名，没有单独的房间类型标签
    expect(screen.queryByText("开场")).not.toBeInTheDocument();
  });

  it("顶部动作区：副本信息 / 叙事 / 离开副本（没有返回副本总览的入口）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    await screen.findByRole("heading", { name: OPENING_HEADING });
    expect(screen.getByRole("button", { name: "副本信息" })).toBeInTheDocument();
    // 叙事入口在共同框架（不分房间类型），与家园页共用同一个组件
    expect(screen.getByRole("button", { name: /查看叙事事件/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "离开副本" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /返回副本总览/ })).not.toBeInTheDocument();
  });

  it("叙事入口：打开浮层看这一局的事件", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: /查看叙事事件/ }));

    expect(await screen.findByRole("dialog", { name: "全部叙事" })).toBeInTheDocument();
  });

  it("副本信息：展示副本进度，并标出队伍当前所在的房间", async () => {
    server.use(instantTasks());
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
    server.use(exitWith(9), tasksWithStuck(9));
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    // 远离开场房间的退出守卫：先等自动初始化完成
    await waitForInit();

    fireEvent.click(screen.getByRole("button", { name: "离开副本" }));

    expect(await screen.findByRole("button", { name: "退出中…" })).toBeDisabled();
    // 还没结束，人还留在房间页
    expect(screen.getByRole("heading", { name: OPENING_HEADING })).toBeInTheDocument();
  });

  it("离开副本：任务终态后回家园（后端在任务里已经把人传回去）", async () => {
    server.use(exitWith(9), tasksWithStuck(-1));
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await waitForInit();

    fireEvent.click(screen.getByRole("button", { name: "离开副本" }));

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

describe("副本房间 · 开场房间", () => {
  it("自动初始化失败时：显示原因、保留可点的「初始化开场」，并锁住推进与退出", async () => {
    const initSpy = vi.fn();
    server.use(failingInit(initSpy));
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    // 环境叙述固定区始终在（正文由 EnvironmentComponent 的 narrative 提供）
    const narrative = await screen.findByRole("region", { name: "环境叙述" });
    expect(await within(narrative).findByText(/义庄前院 的环境叙述/)).toBeInTheDocument();

    // 自动初始化只发一次；失败后不自动重试
    expect(await screen.findByText(/开场动作失败/)).toBeInTheDocument();
    expect(initSpy).toHaveBeenCalledTimes(1);

    // 「初始化开场」保留为手动重试入口
    const retry = screen.getByRole("button", { name: "初始化开场" });
    expect(retry).toBeEnabled();

    // 未初始化 → 服务端不允许推进 / 退出，两个按钮都禁用并说明原因
    expect(screen.getByRole("button", { name: "进入下一关" })).toBeDisabled();
    expect(screen.getByText("开场房间尚未初始化，无法进入下一关。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "离开副本" })).toBeDisabled();
    expect(screen.getByText("开场房间尚未初始化，无法离开副本。")).toBeInTheDocument();

    // 手动重试会再发一次初始化
    fireEvent.click(retry);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(2));
  });

  it("进入开场房间自动初始化一次；完成前不给「生成奖励」", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    // 自动初始化完成后才出现「生成奖励」，且「初始化开场」收起
    await waitForInit();
    expect(screen.queryByRole("button", { name: "初始化开场" })).not.toBeInTheDocument();
  });

  it("生成奖励：每个成员出现 3 张候选卡（各带「挑选」）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    await prepareSpoils();

    expect(await screen.findByRole("button", { name: "挑选 火折子" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^挑选 / })).toHaveLength(3);
    expect(screen.getByText("奖励 3 选 1，挑走一张后其余作废")).toBeInTheDocument();
    // 生成后奖励按钮收起（同一时间只给「当前该做的那一步」）
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();
  });

  it("领卡：领走的那张进牌组，候选保留并标记已领取（不能再生成）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await prepareSpoils();
    expect(await screen.findByText("牌组 3 张")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "挑选 火折子" }));

    // 牌组 +1；候选仍在（供回看），但「挑选」按钮消失
    expect(await screen.findByText("牌组 4 张")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^挑选 / })).not.toBeInTheDocument();
    expect(screen.getByText("（已领取，以下为本次候选，仅供参考）")).toBeInTheDocument();
    // 组件保留作为守卫：生成按钮不再回来
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();
  });

  it("领卡是按成员各自算的：给顾知秋领卡不影响玩家的奖励", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.顾知秋");
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await prepareSpoils();

    // 两个人各 3 张候选
    expect(await screen.findAllByRole("button", { name: /^挑选 / })).toHaveLength(6);

    const qiuzhiSection = screen.getByRole("heading", { name: "顾知秋" }).closest("section");
    if (!(qiuzhiSection instanceof HTMLElement)) {
      throw new Error("找不到顾知秋那一段");
    }
    fireEvent.click(within(qiuzhiSection).getByRole("button", { name: "挑选 镇棺符" }));

    // 顾知秋已领取（候选保留、按钮消失），玩家那边还是 3 张待挑
    expect(
      await within(qiuzhiSection).findByText("（已领取，以下为本次候选，仅供参考）"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^挑选 / })).toHaveLength(3);
  });

  it("牌组浮窗：点开看这个成员现在有哪些牌", async () => {
    server.use(instantTasks());
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

  it("叙事入口不再放在开场房间体内（它是共同框架的一部分）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    // 叙事按钮只有一个（在顶部动作区），开场房间不再各自渲染一份
    await screen.findByRole("heading", { name: OPENING_HEADING });
    expect(screen.getAllByRole("button", { name: /查看叙事事件/ })).toHaveLength(1);
  });

  it("进入下一关：确认框列出下一间与奖励状态，确认后落到战斗房间", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await waitForInit();

    fireEvent.click(screen.getByRole("button", { name: "进入下一关" }));

    const dialog = await screen.findByRole("dialog", { name: "进入下一关" });
    // 下一间是战斗房间，名字与类型都摊开
    expect(within(dialog).getByText("停柩房")).toBeInTheDocument();
    expect(within(dialog).getByText("战斗")).toBeInTheDocument();
    // 奖励只提示、不阻止（初始化是硬前置，已由按钮禁用把关）
    expect(within(dialog).getByText(/奖励 暂无候选/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "进入下一关" }));

    // 副本推进到战斗房间：开场房间那一屏被换掉
    expect(await screen.findByText("战斗房间界面尚未实现。")).toBeInTheDocument();
  });

  it("进入下一关失败时把后端原因显示在确认框里", async () => {
    server.use(
      instantTasks(),
      http.post(api("/api/dungeon/progress/advance_stage/v1/"), () =>
        HttpResponse.json({ detail: "副本已全部通关，请返回营地" }, { status: 409 }),
      ),
    );
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await waitForInit();

    fireEvent.click(screen.getByRole("button", { name: "进入下一关" }));
    const dialog = await screen.findByRole("dialog", { name: "进入下一关" });
    fireEvent.click(within(dialog).getByRole("button", { name: "进入下一关" }));

    expect(await within(dialog).findByText(/副本已全部通关/)).toBeInTheDocument();
  });
});
