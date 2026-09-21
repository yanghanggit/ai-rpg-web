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

/** 进入开场房间会自动初始化；等到角色卡上那颗「生成奖励」可点（= `initialized=true`）为止。 */
async function waitForInit() {
  await waitFor(() => {
    for (const button of screen.getAllByRole("button", { name: "生成奖励" })) {
      expect(button).toBeEnabled();
    }
  });
}

/** 某个成员卡底那颗奖励按钮（三态：生成奖励 / 获取奖励 / 查看奖励）。 */
function spoilsButton(memberName: string) {
  const card = screen.getByRole("button", { name: displayName(memberName) }).closest("article");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`找不到 ${memberName} 的角色卡`);
  }
  return within(card).getByRole("button", { name: /奖励/ });
}

/** 走完「（自动）初始化 → 生成奖励」；生成是**整队一次**的动作，点哪张卡上那颗都一样。 */
async function generateSpoils() {
  await waitForInit();
  fireEvent.click(spoilsButton("角色.无名"));
  await screen.findAllByRole("button", { name: "获取奖励" });
}

/** 打开某个成员的奖励浮窗：点其角色卡上的「获取奖励 / 查看奖励」。 */
async function openSpoils(memberName: string) {
  fireEvent.click(spoilsButton(memberName));
  return screen.findByRole("dialog", { name: "奖励" });
}

/** 打开「副本操作」菜单（叙事 / 离开副本 两个动作收在这一个入口里）。 */
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

  it("标题行三个平级入口（副本操作 / 副本信息 / 牌组）；菜单里只剩叙事 / 离开副本", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    await screen.findByRole("heading", { name: OPENING_HEADING });
    // 三个入口都在标题行上、彼此平级
    expect(screen.getByRole("button", { name: /副本操作/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "副本信息" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "牌组" })).toBeInTheDocument();
    // 「离开副本」仍然不直接摊在页面上，只在菜单里
    expect(screen.queryByRole("button", { name: "离开副本" })).not.toBeInTheDocument();

    const menu = await openActions();
    // 叙事入口在共同框架（不分房间类型），与家园页共用同一套数据/未读算法
    expect(within(menu).getByRole("button", { name: "叙事" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "离开副本" })).toBeInTheDocument();
    // 「副本信息」已提到标题行，不再是菜单里的一项
    expect(within(menu).queryByRole("button", { name: "副本信息" })).not.toBeInTheDocument();
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

  it("副本信息：从标题行直接打开，展示副本进度，并标出队伍当前所在的房间", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    const infoEntry = await screen.findByRole("button", { name: "副本信息" });
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
    expect(entry).not.toHaveClass("icon-button--unread");

    // 生成奖励 → 失效叙事 → 新事件到达：入口按钮变绿并带上未读数
    await waitForInit();
    fireEvent.click(spoilsButton("角色.无名"));
    await waitFor(() => expect(entry).toHaveClass("icon-button--unread"));
    expect(within(entry).getByText("1")).toBeInTheDocument();

    // 打开菜单里的「叙事」即视为已读，信号消失
    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "叙事" }));
    await screen.findByRole("dialog", { name: "全部叙事" });
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    await waitFor(() => expect(entry).not.toHaveClass("icon-button--unread"));
  });

  it("牌组入口：一级名单（玩家在前）→ 二级紧凑卡面（词缀只留名称）→ 三级卡牌详情", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.顾知秋");
    addMockRosterMember("角色.小厮");
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 入口与齿轮平级，同在标题行
    fireEvent.click(await screen.findByRole("button", { name: "牌组" }));

    const list = await screen.findByRole("dialog", { name: "队伍牌组" });
    // 每一行是一颗按钮（名字 + 张数），玩家必须排第一
    const rows = within(list).getAllByRole("button", { name: /张$/ });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("无名");
    expect(rows[0]).toHaveTextContent("玩家");
    expect(within(list).getByText("9 张")).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /顾知秋/ }));

    const deck = await screen.findByRole("dialog", { name: "牌组" });
    expect(within(deck).getByText("顾知秋 · 共 5 张")).toBeInTheDocument();
    // 一行最多三张：5 张 → 三列、两行（行高由网格统一，不由内容撑）
    expect(within(deck).getByRole("list")).toHaveClass("card-tiles--deck-3");
    // 紧凑卡面只给词缀名字，不给触发倾向的描述
    expect(within(deck).getByText("[破竹]")).toBeInTheDocument();
    expect(within(deck).queryByText(/本段命中后更容易击穿格挡/)).not.toBeInTheDocument();
    // 二级是叠在一级之上（名单没被关掉），不是同类切换
    expect(screen.getByRole("dialog", { name: "队伍牌组" })).toBeInTheDocument();

    // 点卡 → 三级「卡牌」详情：词缀是完整原文，两层的下层都还在
    fireEvent.click(within(deck).getByRole("button", { name: "查看卡牌：撬棍横击" }));
    const detail = await screen.findByRole("dialog", { name: "卡牌" });
    expect(within(detail).getByText(/本段命中后更容易击穿格挡/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "牌组" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "队伍牌组" })).toBeInTheDocument();

    // 关三级 → 回到牌组；再关牌组 → 回到名单
    fireEvent.click(within(detail).getByRole("button", { name: "关闭" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "卡牌" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: "牌组" })).toBeInTheDocument();

    fireEvent.click(within(deck).getByRole("button", { name: "关闭" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "牌组" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: "队伍牌组" })).toBeInTheDocument();
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
  it("自动初始化失败时：显示原因、标题行留下可点的「重试初始化开场」，结束与退出都由服务端拦", async () => {
    const initSpy = vi.fn();
    server.use(failingInit(initSpy));
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 初始化失败写在场景卡里：卡片本身变成本间的主行动（点整张卡重试）
    const stage = await screen.findByRole("region", { name: "场景描述" });
    const stageCard = within(stage).getByRole("button", { name: "场景描述：重试初始化开场" });
    expect(stageCard).toHaveTextContent("初始化失败");

    // 自动初始化只发一次；失败后不自动重试
    expect(initSpy).toHaveBeenCalledTimes(1);

    // 失败 → 标题行那颗 ↻ 变成红色错误色，名字是「重试初始化开场」（可点）
    const retry = screen.getByRole("button", { name: "重试初始化开场" });
    expect(retry).toBeEnabled();
    expect(retry).toHaveClass("icon-button--err");

    // 未初始化时角色卡上的奖励按钮在、但不可点（生成是服务端硬前置）
    expect(await screen.findByRole("button", { name: "生成奖励" })).toBeDisabled();

    // 未初始化 → 本间的主行动就是"把它跑起来"，「结束开局准备」这件事根本不存在；
    // 页面上也没有解释性提示行（初始化状态写在场景卡里，不需要再说一遍）
    expect(screen.queryByRole("button", { name: "结束开局准备" })).not.toBeInTheDocument();
    expect(screen.queryByText(/才能结束本间或离开副本/)).not.toBeInTheDocument();

    // 「离开副本」不做客户端预判：按钮可点，点下去由服务端拦（原因原样显示）
    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "离开副本" }));
    expect(
      await screen.findByText("离开副本失败：开场房间尚未初始化，无法退出"),
    ).toBeInTheDocument();
    // 人还在本间（副本没被拆）
    expect(screen.getByRole("button", { name: "重试初始化开场" })).toBeInTheDocument();

    // 点场景卡重试（与标题行那颗 ↻ 同一件事）
    fireEvent.click(stageCard);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(2));

    // 标题行那颗是兜底：同样能重试
    fireEvent.click(retry);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(3));
  });

  it("初始化完成后：场景卡上是环境叙述，点卡看全文；右侧「回到地图」卡就是本间的下一步", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
    await waitForInit();

    // 初始化中之后：卡面换成环境叙述（超出三行在卡上省略，全文在浮窗里）
    const stage = screen.getByRole("region", { name: "场景描述" });
    const card = within(stage).getByRole("button", { name: "场景描述：查看场景信息" });
    expect(card).toHaveTextContent(/义庄前院 的环境叙述/);

    // 点卡 → 场景信息浮窗：完整叙述 + 场景内角色；点角色即换成角色浮窗（同类切换不叠层）
    fireEvent.click(card);
    const dialog = await screen.findByRole("dialog", { name: "场景信息" });
    expect(await within(dialog).findByText(/门轴涩住/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "无名" }));
    expect(await screen.findByRole("dialog", { name: "角色信息" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "场景信息" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    // 「回到地图」卡：与标题行那颗 → 同一件事（body 上这份更显眼、更好点）
    fireEvent.click(within(stage).getByRole("button", { name: "结束开局准备（回到地图）" }));
    expect(await screen.findByRole("heading", { name: "地图" })).toBeInTheDocument();
  });

  it("队伍区没有可见标题（卡上有名字就够），玩家卡片标「玩家」，不再有「3 选 1」提示", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 这一块留着无障碍名，但没有可见标题（卡上有名字，「队伍」是废话）
    expect(await screen.findByRole("region", { name: "队伍" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "队伍" })).not.toBeInTheDocument();
    // 玩家徽章叫「玩家」，不叫「你」
    expect(await screen.findByText("玩家")).toBeInTheDocument();
    expect(screen.queryByText("你")).not.toBeInTheDocument();
    // 旧的奖励提示句已删掉
    expect(screen.queryByText(/3 选 1/)).not.toBeInTheDocument();
  });

  it("进入开场房间自动初始化一次；完成后标题行那颗图标从 ↻（初始化）变成 →（结束本间）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 自动初始化完成后：本间的主行动从「初始化」换成「结束开局准备」
    await waitForInit();
    const finish = screen.getByRole("button", { name: "结束开局准备" });
    expect(finish).toHaveTextContent("→");
    expect(screen.queryByRole("button", { name: /初始化开场/ })).not.toBeInTheDocument();
  });

  it("生成奖励：不摊在页面上，角色卡那颗按钮从「生成奖励」变成「获取奖励」，弹窗里竖排 3 张候选", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    await generateSpoils();

    // 奖励不在页面上展开，只在卡上留一个按钮
    expect(screen.getByRole("button", { name: "获取奖励" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^挑选 / })).not.toBeInTheDocument();

    const dialog = await openSpoils("角色.无名");
    expect(within(dialog).getByRole("button", { name: "挑选 火折子" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /^挑选 / })).toHaveLength(3);

    // 生成后按钮不再是「生成奖励」（同一个按钮进了下一态）
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();
  });

  it("领卡：领走的那张进牌组，候选保留并标记已领取（不能再生成）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
    await generateSpoils();
    expect(await screen.findByText("DECK 9")).toBeInTheDocument();

    const dialog = await openSpoils("角色.无名");
    fireEvent.click(within(dialog).getByRole("button", { name: "挑选 火折子" }));

    // 牌组 +1；候选仍在（供回看），但「挑选」按钮消失
    expect(await screen.findByText("DECK 10")).toBeInTheDocument();
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

    // 两个人各有一颗奖励按钮（三态共用同一个位置）
    expect(screen.getAllByRole("button", { name: /奖励/ })).toHaveLength(2);

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

  it("奖励按钮是同一颗的三态：生成奖励 → 获取奖励 → 查看奖励（生成是整队一次）", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.顾知秋");
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 一态：两张卡各有一颗「生成奖励」
    await waitForInit();
    expect(screen.getAllByRole("button", { name: "生成奖励" })).toHaveLength(2);

    // 点**一个人的**「生成奖励」= 整队一次生成：两张卡一起进第二态
    fireEvent.click(spoilsButton("角色.无名"));
    expect(await screen.findAllByRole("button", { name: "获取奖励" })).toHaveLength(2);

    // 二态：获取奖励 → 领走一张
    const dialog = await openSpoils("角色.顾知秋");
    fireEvent.click(within(dialog).getByRole("button", { name: "挑选 火折子" }));

    // 三态：领过的那个人变成「查看奖励」；没领的那个人还在「获取奖励」（领取是按成员各自的）
    expect(await screen.findAllByRole("button", { name: "查看奖励" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "获取奖励" })).toHaveLength(1);
  });

  it("角色卡上不再有「查看牌组」：牌组入口只有标题行那一份", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();

    // 卡上只留「Deck N」这行状态，卡底那颗按钮就是奖励入口
    expect(await screen.findByText("DECK 9")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看牌组" })).not.toBeInTheDocument();
    // 同一份数据仍然看得到：入口上提到标题行（一级名单 → 二级卡面，分开用例覆盖）
    expect(screen.getByRole("button", { name: "牌组" })).toBeInTheDocument();
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

  it("结束开局准备：把人送到房间之间的地图（本间结束，队伍位置还没变）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
    await waitForInit();

    fireEvent.click(screen.getByRole("button", { name: "结束开局准备" }));

    // 落点是地图（房间之间那一站）：标题只留副本名，房间那一行标「已完成」，动作搬到下一间那一行。
    // 推进不在这里发生——队伍的位置只在地图上由「前往下一间」改变。
    expect(await screen.findByRole("heading", { name: "地图" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "荒村义庄" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前往下一间" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "进入房间" })).not.toBeInTheDocument();
  });

  it("未领的奖励只提示不阻止：「!」长在那张卡的按钮上，后果写在 title 里（惩罚是设计要的）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
    await generateSpoils();

    // 提醒不另占一行页面提示，而是做在按钮上（提醒色 + 「!」，可看到的文案仍是动作名）
    const reward = screen.getByRole("button", { name: "获取奖励" });
    expect(reward).toHaveClass("button--pending");
    expect(reward).toHaveAttribute("title", "还有候选卡未领：结束本间后就无法再领取了。");
    // 同一件事也做到标题行那颗「结束本间」上：一按就永久失去，所以它也变提醒色
    const finish = screen.getByRole("button", { name: "结束开局准备" });
    expect(finish).toHaveClass("icon-button--warn");
    expect(finish).toHaveAttribute(
      "title",
      "结束开局准备（回到地图）—— 还有候选卡未领，结束本间后就无法再领取了。",
    );
    // 结束动作照旧可用（不套二次确认）
    expect(screen.getByRole("button", { name: "结束开局准备" })).toBeEnabled();
  });

  it("奖励都领完之后：卡上的「!」与标题行的提醒色一起消失", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderOpening();
    await generateSpoils();
    const dialog = await openSpoils("角色.无名");
    fireEvent.click(within(dialog).getByRole("button", { name: "挑选 火折子" }));

    expect(await screen.findByRole("button", { name: "查看奖励" })).not.toHaveClass(
      "button--pending",
    );
    expect(screen.getByRole("button", { name: "结束开局准备" })).not.toHaveClass(
      "icon-button--warn",
    );
  });
});
