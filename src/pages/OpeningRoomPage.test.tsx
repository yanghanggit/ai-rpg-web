import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Schemas } from "../api/types";
import { displayName } from "../components/displayName";
import { enterMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { addMockRosterMember } from "../mocks/roster";
import { sseResponse } from "../mocks/sseResponse";
import { instantTasks, renderRoom } from "../test/RoomHarness";
import DungeonRoomRoute from "./DungeonRoomRoute";

/**
 * `OpeningRoomPage` 的测试。
 *
 * 房间页需要一个**已解析的** `room`（初始化后要重新取 `/room` 才能看到 `initialized` 翻转），
 * 所以统一从路由挂载 `<DungeonRoomRoute/>`——解析器会把它分发到本页；`?seed` 深链与这里无关。
 */
const renderOpening = () => renderRoom(<DungeonRoomRoute />);

/** 开场房间的标题：副本名 (当前/总数) 房间名。 */
const OPENING_HEADING = "荒村义庄 (1/2) 义庄前院";

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

/** 打开「副本操作」菜单（副本信息 / 叙事 / 离开副本 三个动作都收在这一个入口里）。 */
async function openActions() {
  fireEvent.click(await screen.findByRole("button", { name: /副本操作/ }));
  return screen.findByRole("dialog", { name: "副本操作" });
}

/** 共同框架用开场房间验证（它同样适用于战斗房间，见 `CombatRoomPage.test.tsx` 的标题断言）。 */
describe("副本房间 · 共同框架", () => {
  it("标题 = 副本名 (当前/总数) 房间名（不是「开场」这类类型名）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    expect(await screen.findByRole("heading", { name: OPENING_HEADING })).toBeInTheDocument();
    // 只有房间名，没有单独的房间类型标签
    expect(screen.queryByText("开场")).not.toBeInTheDocument();
  });

  it("顶部动作区折叠成「副本操作」入口；菜单里有三个动作，没有返回副本总览的入口", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    await screen.findByRole("heading", { name: OPENING_HEADING });
    // 三个动作不再直接摊在页面上
    expect(screen.queryByRole("button", { name: "副本信息" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "离开副本" })).not.toBeInTheDocument();

    const menu = await openActions();
    expect(within(menu).getByRole("button", { name: "副本信息" })).toBeInTheDocument();
    // 叙事入口在共同框架（不分房间类型），与家园页共用同一套数据/未读算法
    expect(within(menu).getByRole("button", { name: "叙事" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "离开副本" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /返回副本总览/ })).not.toBeInTheDocument();
  });

  it("叙事入口：从菜单打开浮层看这一局的事件（菜单关闭，不叠层）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "叙事" }));

    expect(await screen.findByRole("dialog", { name: "全部叙事" })).toBeInTheDocument();
    // 菜单已关闭：同类浮窗是切换而不是叠加
    expect(screen.queryByRole("dialog", { name: "副本操作" })).not.toBeInTheDocument();
  });

  it("副本信息：展示副本进度，并标出队伍当前所在的房间", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    const menu = await openActions();
    const infoEntry = within(menu).getByRole("button", { name: "副本信息" });
    // 「副本信息」要等 `/state` 回来才有内容，在此之前是禁用的
    await waitFor(() => expect(infoEntry).toBeEnabled());
    fireEvent.click(infoEntry);

    const dialog = await screen.findByRole("dialog", { name: "副本信息" });
    // 起点是 rooms[0]（义庄前院）
    expect(within(dialog).getByText("第 1 / 2 间")).toBeInTheDocument();
    expect(within(dialog).getByText("当前所在")).toBeInTheDocument();
    // 房间列表仍然照旧（类型 + 敌人）
    expect(within(dialog).getByText("停柩房")).toBeInTheDocument();
    expect(within(dialog).getByText(/HP 16/)).toBeInTheDocument();
  });

  it("新叙事未读时，入口按钮变绿并带上未读数；打开即已读", async () => {
    let hasNewMessage = false;
    const newMessage: Schemas["SessionMessage"] = {
      sequence_id: 1,
      agent_event: {
        type: "announce",
        message: "新事件",
        actor: "旁白",
        stage: "场景.义庄前院",
        content: "新事件",
      },
    };
    server.use(
      instantTasks(),
      http.post(api("/api/dungeon/opening/generate_spoils/v1/"), () => {
        hasNewMessage = true;
        return HttpResponse.json({ job_id: 2, message: "ok" });
      }),
      http.get(api("/api/session_messages/v1/:userName/:gameName/since"), ({ request }) => {
        const since = Number(new URL(request.url).searchParams.get("last_sequence_id") ?? 0);
        const all = hasNewMessage ? [newMessage] : [];
        return HttpResponse.json({
          session_messages: all.filter((message) => message.sequence_id > since),
        });
      }),
    );
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 首屏没有事件：入口按钮不亮
    const entry = await screen.findByRole("button", { name: /副本操作/ });
    await waitForInit();
    expect(entry).not.toHaveClass("count-button--unread");

    // 生成奖励 → 失效叙事 → 新事件到达：入口按钮变绿并带上未读数
    fireEvent.click(screen.getByRole("button", { name: "生成奖励" }));
    await waitFor(() => expect(entry).toHaveClass("count-button--unread"));
    expect(within(entry).getByText("1")).toBeInTheDocument();

    // 打开菜单里的「叙事」即视为已读，信号消失
    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "叙事" }));
    await screen.findByRole("dialog", { name: "全部叙事" });
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    await waitFor(() => expect(entry).not.toHaveClass("count-button--unread"));
  });

  it("离开副本：从菜单触发后入口变「退出中…」并禁用", async () => {
    server.use(exitWith(9), tasksWithStuck(9));
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
    // 远离开场房间的退出守卫：先等自动初始化完成
    await waitForInit();

    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "离开副本" }));

    expect(await screen.findByRole("button", { name: "副本操作（退出中）" })).toBeDisabled();
    // 菜单已关，人还留在房间页
    expect(screen.queryByRole("dialog", { name: "副本操作" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: OPENING_HEADING })).toBeInTheDocument();
  });

  it("离开副本：任务终态后回家园（后端在任务里已经把人传回去）", async () => {
    server.use(exitWith(9), tasksWithStuck(-1));
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
    await waitForInit();

    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "离开副本" }));

    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
  });
});

describe("副本房间 · 开场房间", () => {
  it("自动初始化失败时：显示原因、保留可点的「初始化开场」，并锁住推进与退出", async () => {
    const initSpy = vi.fn();
    server.use(failingInit(initSpy));
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 环境叙述固定区始终在（正文由 EnvironmentComponent 的 narrative 提供）
    const narrative = await screen.findByRole("region", { name: "环境叙述" });
    expect(await within(narrative).findByText(/义庄前院 的环境叙述/)).toBeInTheDocument();

    // 自动初始化只发一次；失败后不自动重试
    expect(await screen.findByText(/开场动作失败/)).toBeInTheDocument();
    expect(initSpy).toHaveBeenCalledTimes(1);

    // 「初始化开场」保留为手动重试入口
    const retry = screen.getByRole("button", { name: "初始化开场" });
    expect(retry).toBeEnabled();

    // 未初始化 → 服务端不允许推进 / 退出，按钮都禁用并说明原因
    expect(screen.getByRole("button", { name: "进入下一关" })).toBeDisabled();
    expect(screen.getByText("开场房间尚未初始化，无法进入下一关。")).toBeInTheDocument();
    // 「离开副本」被锁的原因写在页面上；菜单里的该项禁用
    expect(screen.getByText("开场房间尚未初始化，无法离开副本。")).toBeInTheDocument();
    const menu = await openActions();
    expect(within(menu).getByRole("button", { name: "离开副本" })).toBeDisabled();
    fireEvent.click(within(menu).getByRole("button", { name: "关闭" }));

    // 手动重试会再发一次初始化
    fireEvent.click(retry);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(2));
  });

  it("队伍区：标题是「队伍」、玩家卡片标「玩家」，不再有「3 选 1」提示", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

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
    renderOpening();

    // 自动初始化完成后才出现「生成奖励」，且「初始化开场」收起
    await waitForInit();
    expect(screen.queryByRole("button", { name: "初始化开场" })).not.toBeInTheDocument();
  });

  it("生成奖励：不摊在页面上，角色卡出现「奖励」按钮，弹窗里竖排 3 张候选", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

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
    renderOpening();
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
    renderOpening();
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
    renderOpening();

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
    renderOpening();

    fireEvent.click(await screen.findByRole("button", { name: "查看牌组" }));

    const dialog = await screen.findByRole("dialog", { name: "牌组" });
    expect(within(dialog).getByText("无名 · 共 3 张")).toBeInTheDocument();
    expect(within(dialog).getByText("剖棺")).toBeInTheDocument();
    expect(within(dialog).getByText("常驻厌胜")).toBeInTheDocument();
    // 不可出牌的卡在卡面上有标记
    expect(within(dialog).getByText("不可出牌")).toBeInTheDocument();
  });

  it("叙事入口只有一份，在「副本操作」菜单里（开场房间体内不再渲染）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    await screen.findByRole("heading", { name: OPENING_HEADING });
    // 页面上不再直接有「叙事」按钮，只有菜单里一份
    expect(screen.queryByRole("button", { name: "叙事" })).not.toBeInTheDocument();
    const menu = await openActions();
    expect(within(menu).getAllByRole("button", { name: "叙事" })).toHaveLength(1);
  });

  it("进入下一关：确认框列出下一间与奖励状态，确认后落到战斗房间", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
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
    renderOpening();
    await waitForInit();

    fireEvent.click(screen.getByRole("button", { name: "进入下一关" }));
    const dialog = await screen.findByRole("dialog", { name: "进入下一关" });
    fireEvent.click(within(dialog).getByRole("button", { name: "进入下一关" }));

    expect(await within(dialog).findByText(/副本已全部通关/)).toBeInTheDocument();
  });
});
