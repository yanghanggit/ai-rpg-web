import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { displayName } from "../components/displayName";
import { prepareMockPostCombat } from "../mocks/combat";
import { advanceMockDungeon, enterMockDungeon } from "../mocks/dungeons";
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

/** 走完「（自动）初始化 → 生成奖励」，角色卡上出现「奖励」按钮即就绪。 */
async function generateSpoils() {
  fireEvent.click(await waitForInit());
  await screen.findAllByRole("button", { name: "奖励" });
}

/** 打开某个成员的奖励浮窗：点其角色卡上的「奖励」按钮。 */
async function openSpoils(memberName: string) {
  const card = screen.getByRole("button", { name: displayName(memberName) }).closest("article");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`找不到 ${memberName} 的角色卡`);
  }
  fireEvent.click(within(card).getByRole("button", { name: "奖励" }));
  return screen.findByRole("dialog", { name: "奖励" });
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

  it("队伍区：标题是「队伍」、玩家卡片标「玩家」，不再有「3 选 1」提示", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    expect(await screen.findByRole("heading", { name: "队伍" })).toBeInTheDocument();
    // 玩家徽章叫「玩家」，不叫「你」
    expect(await screen.findByText("玩家")).toBeInTheDocument();
    expect(screen.queryByText("你")).not.toBeInTheDocument();
    // 旧的奖励提示句已删掉
    expect(screen.queryByText(/3 选 1/)).not.toBeInTheDocument();
  });

  it("进入开场房间自动初始化一次；完成前不给「生成奖励」", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    // 自动初始化完成后才出现「生成奖励」，且「初始化开场」收起
    await waitForInit();
    expect(screen.queryByRole("button", { name: "初始化开场" })).not.toBeInTheDocument();
  });

  it("生成奖励：不摊在页面上，角色卡出现「奖励」按钮，弹窗里竖排 3 张候选", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    await generateSpoils();

    // 奖励不在页面上展开，只在卡上留一个按钮
    expect(screen.getByRole("button", { name: "奖励" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^挑选 / })).not.toBeInTheDocument();

    const dialog = await openSpoils("角色.无名");
    expect(within(dialog).getByRole("button", { name: "挑选 火折子" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /^挑选 / })).toHaveLength(3);

    // 生成后「生成奖励」按钮收起
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();
  });

  it("领卡：领走的那张进牌组，候选保留并标记已领取（不能再生成）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await generateSpoils();
    expect(await screen.findByText("牌组 3 张")).toBeInTheDocument();

    const dialog = await openSpoils("角色.无名");
    fireEvent.click(within(dialog).getByRole("button", { name: "挑选 火折子" }));

    // 牌组 +1；候选仍在（供回看），但「挑选」按钮消失
    expect(await screen.findByText("牌组 4 张")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^挑选 / })).not.toBeInTheDocument();
    expect(within(dialog).getByText("（已领取，以下为本次候选，仅供参考）")).toBeInTheDocument();
    // 组件保留作为守卫：生成按钮不再回来
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();
  });

  it("领卡是按成员各自算的：给顾知秋领卡不影响玩家的奖励", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.顾知秋");
    enterMockDungeon("副本.荒村义庄");
    renderRoom();
    await generateSpoils();

    // 两个人各有一个「奖励」按钮
    expect(screen.getAllByRole("button", { name: "奖励" })).toHaveLength(2);

    const qiuzhi = await openSpoils("角色.顾知秋");
    fireEvent.click(within(qiuzhi).getByRole("button", { name: "挑选 镇棺符" }));

    // 顾知秋已领取（候选保留、按钮消失）
    expect(
      await within(qiuzhi).findByText("（已领取，以下为本次候选，仅供参考）"),
    ).toBeInTheDocument();
    fireEvent.click(within(qiuzhi).getByRole("button", { name: "关闭" }));

    // 玩家那边还是 3 张待挑
    const player = await openSpoils("角色.无名");
    expect(within(player).getAllByRole("button", { name: /^挑选 / })).toHaveLength(3);
  });

  it("角色卡片：点名字开角色信息（副本里不提供时装入口）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "无名" }));

    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    await within(dialog).findByText("属性");
    // 副本进行中家园接口会被拒，所以隐藏时装区
    expect(within(dialog).queryByRole("heading", { name: "时装" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /时装/ })).not.toBeInTheDocument();
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

    // 副本推进到战斗房间：开场房间那一屏被换掉，标题变成战斗房间
    expect(
      await screen.findByRole("heading", { name: "荒村义庄 (2/2) 停柩房" }),
    ).toBeInTheDocument();
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

/** 进入副本并直接推进到战斗房间（跳过开场流程），再渲染房间页。 */
function renderCombatRoom() {
  enterMockDungeon("副本.荒村义庄");
  advanceMockDungeon();
  renderRoom();
}

/** 找到某张手牌所在的 <li>（出牌控件在卡面里）。 */
function cardTileOf(cardName: string): HTMLElement {
  const tile = screen.getByText(cardName).closest("li");
  if (!(tile instanceof HTMLElement)) {
    throw new Error(`找不到卡牌 ${cardName} 的卡片`);
  }
  return tile;
}

describe("副本房间 · 战斗房间", () => {
  it("进入战斗房间自动初始化，落到抓牌阶段（参战者 = 队伍 + 怪物）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 标题换成战斗房间
    expect(
      await screen.findByRole("heading", { name: "荒村义庄 (2/2) 停柩房" }),
    ).toBeInTheDocument();
    // 自动初始化完成后出现抓牌按钮
    expect(await screen.findByRole("button", { name: /抓牌/ })).toBeInTheDocument();
    // 参战者：队友不入队时只有玩家 + 两个怪物
    expect(await screen.findByText("纸人")).toBeInTheDocument();
    expect(screen.getByText("棺中殭尸")).toBeInTheDocument();
    expect(screen.getAllByText("怪物")).toHaveLength(2);
  });

  it("自动初始化失败：显示原因并保留可点的「初始化战斗」重试", async () => {
    server.use(
      instantTasks(),
      http.post(api("/api/dungeon/combat/init/v1/"), () =>
        HttpResponse.json({ detail: "mock 初始化失败" }, { status: 500 }),
      ),
    );
    renderCombatRoom();

    expect(await screen.findByText(/初始化战斗失败/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "初始化战斗" })).toBeEnabled();
    // 还没到抓牌阶段
    expect(screen.queryByRole("button", { name: /抓牌/ })).not.toBeInTheDocument();
  });

  it("抓牌后进入玩家回合：显示手牌、能量与过牌按钮", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    fireEvent.click(await screen.findByRole("button", { name: /抓牌/ }));

    expect(await screen.findByRole("heading", { name: "手牌" })).toBeInTheDocument();
    expect(screen.getByText("剖棺")).toBeInTheDocument();
    expect(screen.getByText("屏息")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
  });

  it("出牌：按默认目标打出，回合记录出现该次出牌", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: /抓牌/ }));

    await screen.findByText("剖棺");
    fireEvent.click(within(cardTileOf("剖棺")).getByRole("button", { name: "出牌" }));

    expect(await screen.findByText(/使用『剖棺』对 怪物.纸人/)).toBeInTheDocument();
  });

  it("过牌推进到怪物；推进怪物回合结束后回到抓牌阶段", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: /抓牌/ }));

    // 我方过牌 → 轮到第一个怪物
    fireEvent.click(await screen.findByRole("button", { name: "过牌（结束回合）" }));
    await screen.findByText(/当前由 纸人 行动/);

    // 第一只怪物 → 第二只怪物：等行动者真的换了再点，避免点到忙碌中的按钮
    fireEvent.click(screen.getByRole("button", { name: "推进怪物回合" }));
    await screen.findByText(/当前由 棺中殭尸 行动/);

    // 第二只怪物 → 全员行动完，回抓牌阶段
    fireEvent.click(screen.getByRole("button", { name: "推进怪物回合" }));
    expect(await screen.findByRole("button", { name: /抓牌/ })).toBeInTheDocument();
  });

  it("结算：显示胜负、战利品与收取按钮，怪物标记战死", async () => {
    // 直接预置结算态，不必把整场战斗打一遍
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderRoom();

    expect(await screen.findByText("🏆 战斗胜利！")).toBeInTheDocument();
    // 参战者快照要等 details 回来，战利品才会出现；用 find 等它
    expect(await screen.findByRole("button", { name: "收取战利品（1）" })).toBeEnabled();
    // 战利品走 ItemRow：显示名 + 数量后缀 + 中文类型
    expect(screen.getByText("腐骨 ×2")).toBeInTheDocument();
    expect(screen.getByText("材料")).toBeInTheDocument();
    // 两只怪物都已战死
    expect(screen.getAllByText("已战死")).toHaveLength(2);
  });

  it("结算：收取战利品后列表清空、按钮禁用", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "收取战利品（1）" }));

    expect(await screen.findByText("（本场战斗没有战利品，或已收取）")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收取战利品（0）" })).toBeDisabled();
  });

  it("结算：最后一关点「进入下一关」显示后端原因", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "进入下一关" }));
    expect(await screen.findByText(/进入下一关失败：副本已全部通关/)).toBeInTheDocument();
  });
});
