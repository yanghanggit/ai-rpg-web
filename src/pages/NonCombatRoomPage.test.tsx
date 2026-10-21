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
 * `NonCombatRoomPage` 的测试。
 *
 * 房间页需要一个**已解析的** `room`，所以统一从路由挂载 `<DungeonRoomRoute/>`（`?seed` 深链与这里无关）。
 * 开场房是**事件屏**（背景 + 对话框 + 一列选项），所以断言落在「对话框三态 / 选项清单 / 奖励浮窗」上。
 */
const renderOpening = () => renderRoom(<DungeonRoomRoute />);

/** 房间页不再有可见标题；拿右上角那排入口里的「副本操作」当落地锚。 */
const roomScaffoldLoaded = () => screen.findByRole("button", { name: /副本操作/ });

/** 房间正文那一块（事件屏）。 */
const roomBody = () => screen.getByRole("region", { name: "房间正文" });

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

/**
 * 对话框 = 本间的主行动，一个按钮顺着 初始化 → 生成奖励 → 查看场景 走，
 * 所以它的无障碍名就是「此刻点下去会做什么」。
 */
function box(action: "初始化中" | "重试初始化" | "生成奖励" | "查看场景") {
  return within(roomBody()).getByRole("button", { name: `${action}：地窟入口` });
}

/** 进入开场房间会自动初始化；等自动初始化跑完（对话框从「初始化中」变成「生成奖励」）为止。 */
async function waitForInit() {
  await screen.findByRole("button", { name: "生成奖励：地窟入口" });
}

/** 一个对话选项（奖励类选项的名字带成员名，去向选项带括号里的去向）。 */
function choice(name: string) {
  return within(roomBody()).getByRole("button", { name });
}

/** 走完「（自动）初始化 → 生成奖励」；生成是**整队一次**的动作，之后每个成员各一个选项。 */
async function generateSpoils() {
  await waitForInit();
  fireEvent.click(box("生成奖励"));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /^获取奖励：/ }).length).toBeGreaterThan(0),
  );
}

/** 打开某个成员的奖励浮窗（点它的「获取奖励 / 查看奖励」选项）。 */
async function openSpoils(memberName: string, action: "获取奖励" | "查看奖励" = "获取奖励") {
  fireEvent.click(choice(`${action}：${displayName(memberName)}`));
  return screen.findByRole("dialog", { name: "奖励" });
}

/** 打开「副本操作」菜单（叙事 / 离开副本 两个动作收在这一个入口里）。 */
async function openActions() {
  fireEvent.click(await screen.findByRole("button", { name: /副本操作/ }));
  return screen.findByRole("dialog", { name: "副本操作" });
}

/** 共同框架用开场房间验证（它同样适用于战斗房间，见 `CombatRoomPage.test.tsx` 的入口断言）。 */
describe("副本房间 · 共同框架", () => {
  it("房间页不再有可见标题（副本名 / 进度 / 房间名都在 ⚙ / ⚑ 浮窗里）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    expect(await roomScaffoldLoaded()).toBeInTheDocument();
    // 整张页面不再有标题（副本名 / 进度 / 房间名），也没有单独的房间类型标签
    expect(screen.queryByRole("heading", { name: /荒废地窟/ })).not.toBeInTheDocument();
    expect(screen.queryByText("开场")).not.toBeInTheDocument();
  });

  it("右上角三个平级入口（副本操作 / 地图 / 牌组）；菜单里只剩叙事 / 离开副本", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    await roomScaffoldLoaded();
    // 三个入口都在右上角那排上、彼此平级
    expect(screen.getByRole("button", { name: /副本操作/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "地图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "牌组" })).toBeInTheDocument();
    // 「离开副本」仍然不直接摊在页面上，只在菜单里
    expect(screen.queryByRole("button", { name: "离开副本" })).not.toBeInTheDocument();

    const menu = await openActions();
    // 叙事入口在共同框架（不分房间类型），与家园页共用同一套数据/未读算法
    expect(within(menu).getByRole("button", { name: "叙事" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "离开副本" })).toBeInTheDocument();
    // 「地图」已提到标题行，不再是菜单里的一项；开场房也没有「战斗信息」那一行
    expect(within(menu).queryByRole("button", { name: "地图" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "战斗信息" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /返回副本总览/ })).not.toBeInTheDocument();
  });

  it("叙事入口：从菜单打开浮层看这一局的事件（菜单关闭，不叠层）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "叙事" }));

    expect(await screen.findByRole("dialog", { name: "全部叙事" })).toBeInTheDocument();
    // 菜单已关闭：同类浮窗是切换而不是叠加
    expect(screen.queryByRole("dialog", { name: "副本操作" })).not.toBeInTheDocument();
  });

  it("地图：从标题行直接打开，展示副本进度，并标出队伍当前所在的房间", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    const infoEntry = await screen.findByRole("button", { name: "地图" });
    // 「地图」要等 `/state` 回来才有内容，在此之前是禁用的
    await waitFor(() => expect(infoEntry).toBeEnabled());
    fireEvent.click(infoEntry);

    const dialog = await screen.findByRole("dialog", { name: "地图" });
    // 起点是 rooms[0]（地窟入口）
    expect(within(dialog).getByText("第 1 / 2 间")).toBeInTheDocument();
    expect(within(dialog).getByText("当前所在")).toBeInTheDocument();
    // 房间列表仍然照旧（类型 + 敌人）
    expect(within(dialog).getByText("地窟深处")).toBeInTheDocument();
    expect(within(dialog).getByText(/hp 16/)).toBeInTheDocument();
    // 当前是开场房，没有战斗数据：「战斗信息」按钮不出现
    expect(within(dialog).queryByRole("button", { name: /战斗信息/ })).not.toBeInTheDocument();
  });

  it("新叙事未读时，入口按钮变绿并带上未读数；打开即已读", async () => {
    let hasNewMessage = false;
    const newMessage: Schemas["SessionMessage"] = {
      sequence_id: 1,
      agent_event: {
        type: "announce",
        message: "新事件",
        actor: "旁白",
        stage: "场景.地窟入口",
        content: "新事件",
      },
    };
    server.use(
      instantTasks(),
      http.post(api("/api/dungeon/spoils/generate/v1/"), () => {
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
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    // 首屏没有事件：入口按钮不亮
    const entry = await screen.findByRole("button", { name: /副本操作/ });
    await waitForInit();
    expect(entry).not.toHaveClass("icon-button--unread");

    // 生成奖励（对话框）→ 失效叙事 → 新事件到达：入口按钮变绿并带上未读数
    fireEvent.click(box("生成奖励"));
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
    addMockRosterMember("角色.坏运气");
    addMockRosterMember("角色.麻雀");
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    // 入口与齿轮平级，同在标题行
    fireEvent.click(await screen.findByRole("button", { name: "牌组" }));

    const list = await screen.findByRole("dialog", { name: "牌组一览" });
    // 每一行是一颗按钮（名字 + 张数），玩家必须排第一
    const rows = within(list).getAllByRole("button", { name: /张$/ });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("无名");
    expect(rows[0]).toHaveTextContent("玩家");
    expect(within(list).getByText("9 张")).toBeInTheDocument();
    // 开场房 stage.actors 为空 → 只列我方，不出现「敌方」段
    expect(within(list).getByRole("heading", { name: "我方" })).toBeInTheDocument();
    expect(within(list).queryByRole("heading", { name: "敌方" })).not.toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /坏运气/ }));

    const deck = await screen.findByRole("dialog", { name: "牌组" });
    expect(within(deck).getByText("坏运气 · 共 5 张")).toBeInTheDocument();
    // 固定三列（不随卡数变）：5 张 → 三列、两行，剩下的位置空着
    expect(within(deck).getByRole("list")).toHaveClass("card-tiles--deck");
    // 紧凑卡面只给词缀名字，不给触发倾向的描述
    expect(within(deck).getByText("[破防]")).toBeInTheDocument();
    expect(within(deck).queryByText(/本段命中后更容易击穿格挡/)).not.toBeInTheDocument();
    // 二级是叠在一级之上（名单没被关掉），不是同类切换
    expect(screen.getByRole("dialog", { name: "牌组一览" })).toBeInTheDocument();

    // 点卡 → 三级「卡牌」详情：词缀是完整原文，两层的下层都还在
    fireEvent.click(within(deck).getByRole("button", { name: "查看卡牌：横扫" }));
    const detail = await screen.findByRole("dialog", { name: "卡牌" });
    expect(within(detail).getByText(/本段命中后更容易击穿格挡/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "牌组" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "牌组一览" })).toBeInTheDocument();

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
    expect(screen.getByRole("dialog", { name: "牌组一览" })).toBeInTheDocument();
  });

  it("离开副本：从菜单触发后入口变「退出中…」并禁用", async () => {
    server.use(exitWith(9), tasksWithStuck(9));
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    // 远离开场房间的退出守卫：先等自动初始化完成
    await waitForInit();

    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "离开副本" }));

    expect(await screen.findByRole("button", { name: "副本操作（退出中）" })).toBeDisabled();
    // 菜单已关，人还留在房间页
    expect(screen.queryByRole("dialog", { name: "副本操作" })).not.toBeInTheDocument();
    expect(await roomScaffoldLoaded()).toBeInTheDocument();
  });

  it("离开副本：任务终态后回家园（后端在任务里已经把人传回去）", async () => {
    server.use(exitWith(9), tasksWithStuck(-1));
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await waitForInit();

    const menu = await openActions();
    fireEvent.click(within(menu).getByRole("button", { name: "离开副本" }));

    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
  });
});

describe("副本房间 · 开场房间（事件屏）", () => {
  it("版式：一大张背景 + 一个对话框 + 一列选项，没有角色卡", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    await roomScaffoldLoaded();

    // 背景是场景插图（`room.stage.assets.illustration` → 服务端静态文件，mock 给一张 SVG）
    const backdrop = document.querySelector(".event-backdrop");
    expect(backdrop).toHaveAttribute("src", expect.stringContaining("/assets/image/"));
    // 队伍不再有卡片区：人只以奖励选项出现
    expect(screen.queryByRole("region", { name: "队伍" })).not.toBeInTheDocument();
    expect(document.querySelector(".actor-card")).toBeNull();
  });

  it("自动初始化失败时：原因写在对话框里、点它重试（重试之前不放出奖励）", async () => {
    const initSpy = vi.fn();
    server.use(failingInit(initSpy));
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    // 初始化失败写在对话框里：对话框本身变成本间的主行动（点它重试）
    const failed = await screen.findByRole("button", { name: "重试初始化：地窟入口" });
    expect(failed).toHaveTextContent("初始化失败");
    expect(failed).toHaveClass("event-narrative--failed");

    // 自动初始化只发一次；失败后不自动重试
    expect(initSpy).toHaveBeenCalledTimes(1);

    // 客户端的状态守卫：初始化没成功之前，对话框只给「重试初始化」，
    // 生成奖励 / 成员奖励都还没放出来（服务端其实不拦，顺序纯粹由这里守）
    expect(screen.queryByRole("button", { name: "生成奖励：地窟入口" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^获取奖励：/ })).not.toBeInTheDocument();

    // 非战斗房间无完成态：去向选项始终可用；页面上没有解释性提示行
    expect(choice("结束开局准备（回到地图）")).toBeInTheDocument();
    expect(screen.queryByText(/才能结束本间或离开副本/)).not.toBeInTheDocument();

    // 点对话框重试（本间唯一的重试入口）
    fireEvent.click(failed);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(2));

    // 再点一次依旧重试（不套一次性 guard）
    fireEvent.click(failed);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(3));
  });

  it("初始化完成后：对话框里是环境叙述，生成奖励之后同一个框变成「查看场景」", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await waitForInit();

    // 初始化完成、奖励还没生成：对话框换成初始化写进来的环境叙述，动作词是「生成奖励」
    const boxBefore = box("生成奖励");
    expect(boxBefore).toHaveTextContent(/开场叙事/);
    await generateSpoils();

    // 同一个框翻到下一态：点开是全文 + 场景内角色
    const narrative = box("查看场景");
    expect(narrative).toHaveTextContent(/开场叙事/);
    fireEvent.click(narrative);
    const dialog = await screen.findByRole("dialog", { name: "场景信息" });
    expect(await within(dialog).findByText(/石壁渗水/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "无名" }));
    expect(await screen.findByRole("dialog", { name: "角色信息" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "场景信息" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
  });

  it("进入开场房间自动初始化一次；标题行始终没有本间的主行动（都在对话框上）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    // 初始化中：对话框是主行动但不可点（同一件事只留这一个入口），标题行也没有 ↻
    expect(await screen.findByRole("button", { name: "初始化中：地窟入口" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /初始化开场/ })).not.toBeInTheDocument();

    // 初始化完成后：标题行也没有 →，去向只剩选项清单里那一个
    await waitForInit();
    expect(screen.queryByRole("button", { name: "结束开局准备" })).not.toBeInTheDocument();
    expect(choice("结束开局准备（回到地图）")).toBeInTheDocument();
  });

  it("选项顺序：奖励在前，去向永远是最后一个", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.坏运气");
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await generateSpoils();

    const labels = within(roomBody())
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(labels.at(-1)).toBe("结束开局准备（回到地图）");
    // 奖励按成员各一个（玩家 + 名单里的同伴），排在去向之前
    expect(labels).toContain(`获取奖励：${displayName("角色.无名")}`);
    expect(labels).toContain(`获取奖励：${displayName("角色.坏运气")}`);
  });

  it("生成奖励：页面上只多出选项，弹窗里竖排 3 张候选", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await generateSpoils();

    // 候选卡不在页面上展开：每个成员一个选项，点开才是浮窗
    expect(roomBody()).not.toHaveTextContent("烈焰符");
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();

    const dialog = await openSpoils("角色.无名");
    // 一级是名字列表：一行一条，名字（看细节）+ 类型徽标 + 行尾「拾取」
    expect(within(dialog).getByRole("button", { name: "拾取 烈焰符" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /^拾取 / })).toHaveLength(3);
    expect(within(dialog).getAllByText("卡牌")).toHaveLength(3);
    // 候选卡面不再铺在浮窗里：详情要点头名字那一行
    expect(within(dialog).queryByText(/本段命中后更容易击穿格挡/)).not.toBeInTheDocument();
  });

  it("领卡：领走的那张进牌组，候选保留并标记已领取（不能再生成）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await generateSpoils();

    const dialog = await openSpoils("角色.无名");
    fireEvent.click(within(dialog).getByRole("button", { name: "拾取 烈焰符" }));

    // 候选仍在（供回看），但「拾取」按钮消失、已领取另起一段
    expect(await within(dialog).findByText("已领取 1 张")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^拾取 / })).not.toBeInTheDocument();
    // 候选行不会被写成「已领取」：那一段是候选，行里不再重复状态
    expect(
      within(dialog).queryByText("已领取", { selector: ".action-meta" }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));

    // 选项从「获取奖励」变「查看奖励」（同一件事已经做过）；「生成奖励」不再回来
    expect(
      await screen.findByRole("button", { name: `查看奖励：${displayName("角色.无名")}` }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();

    // 牌组里多了一张（9 → 10）
    fireEvent.click(screen.getByRole("button", { name: "牌组" }));
    const list = await screen.findByRole("dialog", { name: "牌组一览" });
    expect(within(list).getByRole("button", { name: /无名.*10 张/ })).toBeInTheDocument();
  });

  it("领卡是按成员各自算的：给坏运气领卡不影响玩家的奖励", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.坏运气");
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await generateSpoils();

    const qiuzhi = await openSpoils("角色.坏运气");
    fireEvent.click(within(qiuzhi).getByRole("button", { name: "拾取 冰墙" }));

    // 坏运气已领取（候选保留、按钮消失）
    expect(await within(qiuzhi).findByText("已领取 1 张")).toBeInTheDocument();
    fireEvent.click(within(qiuzhi).getByRole("button", { name: "关闭" }));

    // 玩家那边还是 3 张待挑
    const player = await openSpoils("角色.无名");
    expect(within(player).getAllByRole("button", { name: /^拾取 / })).toHaveLength(3);
  });

  it("奖励的态：对话框「生成奖励 → 查看场景」，成员「获取奖励 → 查看奖励」（生成是整队一次）", async () => {
    server.use(instantTasks());
    addMockRosterMember("角色.坏运气");
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    // 还没生成：生成奖励长在对话框上（整队一次，不按人分），清单里一个奖励选项都没有
    await waitForInit();
    expect(screen.queryByRole("button", { name: /^获取奖励：/ })).not.toBeInTheDocument();

    // 点它 = 整队一次生成：对话框翻成「查看场景」，每个成员各出现一个「获取奖励」
    fireEvent.click(box("生成奖励"));
    expect(
      await screen.findByRole("button", { name: `获取奖励：${displayName("角色.坏运气")}` }),
    ).toBeInTheDocument();
    expect(choice(`获取奖励：${displayName("角色.无名")}`)).toBeInTheDocument();
    expect(box("查看场景")).toBeInTheDocument();

    // 二态：获取奖励 → 领走一张
    const dialog = await openSpoils("角色.坏运气");
    fireEvent.click(within(dialog).getByRole("button", { name: "拾取 烈焰符" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "关闭" }));

    // 三态：领过的那个人变「查看奖励」；没领的那个人还在「获取奖励」
    expect(
      await screen.findByRole("button", { name: `查看奖励：${displayName("角色.坏运气")}` }),
    ).toBeInTheDocument();
    expect(choice(`获取奖励：${displayName("角色.无名")}`)).toBeInTheDocument();
  });

  it("叙事入口只有一份，在「副本操作」菜单里（开场房间体内不再渲染）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();

    await roomScaffoldLoaded();
    // 页面上不再直接有「叙事」按钮，只有菜单里一份
    expect(screen.queryByRole("button", { name: "叙事" })).not.toBeInTheDocument();
    const menu = await openActions();
    expect(within(menu).getAllByRole("button", { name: "叙事" })).toHaveLength(1);
  });

  it("结束开局准备：把人送到房间之间的地图（本间结束，队伍位置还没变）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await waitForInit();

    fireEvent.click(choice("结束开局准备（回到地图）"));

    // 落点是地图（房间之间那一站）：房间页框架不再有可见标题，只有地图面板自己的「地图」标题；
    // 房间那一行标「已完成」，动作搬到下一间那一行。
    // 推进不在这里发生——队伍的位置只在地图上由「前往下一间」改变。
    expect(await screen.findByRole("heading", { name: "地图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前往下一间" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "进入房间" })).not.toBeInTheDocument();
  });

  it("未领的奖励只提示不阻止：「!」长在那个选项上，后果写在 title 里（惩罚是设计要的）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await generateSpoils();

    // 提醒不另占一行页面提示，而是做在选项上（提醒色 + 「!」，可看到的文案仍是动作名）
    const reward = choice(`获取奖励：${displayName("角色.无名")}`);
    expect(reward).toHaveClass("event-choice--warn");
    expect(reward).toHaveAttribute(
      "title",
      `获取奖励：${displayName("角色.无名")} —— 还有候选卡未领：结束本间后就无法再领取了。`,
    );
    // 同一件事也做到去向选项上（结束本间的唯一入口）：一按就永久失去，所以它也变提醒色
    const finish = choice("结束开局准备（回到地图）");
    expect(finish).toHaveClass("event-choice--warn");
    expect(finish).toHaveAttribute(
      "title",
      "结束开局准备（回到地图） —— 还有候选卡未领，结束本间后就无法再领取了。",
    );
    // 去向照旧可用（不套二次确认）
    expect(finish).toBeEnabled();
  });

  it("奖励都领完之后：奖励选项上的「!」与去向选项的提醒色一起消失", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderOpening();
    await generateSpoils();
    const dialog = await openSpoils("角色.无名");
    fireEvent.click(within(dialog).getByRole("button", { name: "拾取 烈焰符" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "关闭" }));

    const claimed = await screen.findByRole("button", {
      name: `查看奖励：${displayName("角色.无名")}`,
    });
    expect(claimed).not.toHaveClass("event-choice--warn");
    expect(choice("结束开局准备（回到地图）")).not.toHaveClass("event-choice--warn");
  });
});
