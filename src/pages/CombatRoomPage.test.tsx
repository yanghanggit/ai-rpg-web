import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { prepareMockPostCombat } from "../mocks/combat";
import { advanceMockDungeon, enterMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { instantTasks, renderRoom } from "../test/RoomHarness";
import DungeonRoomRoute from "./DungeonRoomRoute";

/**
 * `CombatRoomPage` 的测试。
 *
 * 与 `OpeningRoomPage.test.tsx` 一样，房间需要一个已解析的 `room`，所以统一从路由挂载
 * `<DungeonRoomRoute/>`——解析器会把它分发到本页；`?seed` 深链与这里无关。
 */
const renderCombat = () => renderRoom(<DungeonRoomRoute />);

/** 进入副本并直接推进到战斗房间（跳过开场流程），再渲染房间页。 */
function renderCombatRoom() {
  enterMockDungeon("副本.荒村义庄");
  advanceMockDungeon();
  renderCombat();
}

/** 找到某张手牌所在的 <li>（选中它是整卡那颗按钮）。 */
function cardTileOf(cardName: string): HTMLElement {
  const tile = screen.getByText(cardName).closest("li");
  if (!(tile instanceof HTMLElement)) {
    throw new Error(`找不到卡牌 ${cardName} 的卡片`);
  }
  return tile;
}

/** 当前行动者那张参战者卡（名单用 `aria-current` 标出来）。 */
function currentCombatant(): HTMLElement {
  const el = document.querySelector('[aria-current="true"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("名单里没有标记当前行动者");
  }
  return el;
}

describe("副本房间 · 战斗房间", () => {
  it("进入战斗房间是准备阶段：上面敌人 / 中间开始卡 / 下面队伍，开始后落到玩家回合", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 标题换成战斗房间
    expect(
      await screen.findByRole("heading", { name: "荒村义庄 (2/2) 停柩房" }),
    ).toBeInTheDocument();
    // 进入战斗房间自动初始化；成功后开局前唯一的动作是「开始」（旧的第一回合引导句已移除）
    expect(await screen.findByRole("button", { name: "开始!" })).toBeInTheDocument();
    expect(screen.queryByText(/抓牌以开启第一回合/)).not.toBeInTheDocument();
    // 参战者：队友不入队时只有玩家 + 四个怪物
    expect(await screen.findByText("纸人")).toBeInTheDocument();
    expect(screen.getByText("棺中殭尸")).toBeInTheDocument();
    expect(screen.getAllByText("怪物")).toHaveLength(4);

    // 开始 = 抓牌：直接落到玩家回合（第一回合有了；初始化是自动跑的）
    fireEvent.click(screen.getByRole("button", { name: "开始!" }));
    expect(await screen.findByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
  });

  it("开局准备：队伍卡整卡可点开角色信息（副本内无时装入口）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    fireEvent.click(await screen.findByRole("button", { name: "查看角色：无名" }));
    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    await within(dialog).findByText("属性");
    // 副本进行中家园接口会被拒，所以隐藏时装区
    expect(within(dialog).queryByRole("heading", { name: "时装" })).not.toBeInTheDocument();
  });

  it("开局准备：敌人卡也能点开（怪物与队伍成员挂同一套组件，外观同样来自 AppearanceComponent）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    fireEvent.click(await screen.findByRole("button", { name: "查看角色：纸人" }));
    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    await within(dialog).findByText("属性");
    expect(within(dialog).getByText("9 / 9")).toBeInTheDocument();
    // 外观来自 AppearanceComponent：初始「当前」=「基础」（怪物不穿时装，真实后端也如此）
    expect(within(dialog).getAllByText(/朱砂笑眼/)).toHaveLength(2);
  });

  it("开局准备：场景卡可点开「场景信息」全文（与开场房同一交互）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    const scene = await screen.findByRole("region", { name: "场景描述" });
    fireEvent.click(within(scene).getByRole("button", { name: "查看场景：停柩房" }));

    const dialog = await screen.findByRole("dialog", { name: "场景信息" });
    expect(within(dialog).getByRole("heading", { name: "环境叙述" })).toBeInTheDocument();
  });

  it("共同框架在战斗房间同样给出三个平级入口（副本操作 / 地图 / 牌组）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    await screen.findByRole("heading", { name: "荒村义庄 (2/2) 停柩房" });
    expect(screen.getByRole("button", { name: /副本操作/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "地图" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "牌组" }));
    const list = await screen.findByRole("dialog", { name: "牌组一览" });
    // 我方：队友没入队时名单里只有玩家（牌组是点开才拉的，所以要等）
    expect(await within(list).findByRole("heading", { name: "我方" })).toBeInTheDocument();
    expect(await within(list).findByRole("button", { name: /无名/ })).toHaveTextContent("玩家");

    // 敌方：本间（停柩房）的怪物与我方同列，且持有牌组
    expect(await within(list).findByRole("heading", { name: "敌方" })).toBeInTheDocument();
    const paper = await within(list).findByRole("button", { name: /纸人/ });
    expect(paper).toHaveTextContent("怪物");
    expect(within(list).getByRole("button", { name: /棺中殭尸/ })).toHaveTextContent("怪物");

    // 怪物也能点进二级看牌组（怪物同样持 DeckComponent）
    fireEvent.click(paper);
    const deck = await screen.findByRole("dialog", { name: "牌组" });
    expect(within(deck).getByText("纸人 · 共 5 张")).toBeInTheDocument();
    // 牌组一律不显示来源（牌必属持有者），即使 mock 里混了别家的牌
    expect(within(deck).queryByText(/来源：/)).not.toBeInTheDocument();
  });

  it("战斗的宏观状态收在 ⚙「副本操作」里：一行「战斗信息」写着状态 / 回合 / 结果，点开看全部回合", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 自动初始化后点开始抓牌，开第一回合，让「战斗信息」有真正的回合数据
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByText("剖棺");

    fireEvent.click(screen.getByRole("button", { name: /副本操作/ }));
    const menu = await screen.findByRole("dialog", { name: "副本操作" });
    const entry = within(menu).getByRole("button", { name: "战斗信息" });
    // 行尾就是那排 chip 的浓缩：状态 / 回合 / 结果
    expect(entry.parentElement).toHaveTextContent("进行中 · 第 1 回合 · 结果 —");

    fireEvent.click(entry);
    const combatInfo = await screen.findByRole("dialog", { name: "战斗信息" });
    // 全部回合的 Round 明细（第 N 回合 + 行动顺序等）
    expect(within(combatInfo).getByText(/第 1 回合/)).toBeInTheDocument();
    expect(within(combatInfo).getByText("行动顺序")).toBeInTheDocument();

    // 同类切换不叠层：菜单已关，只剩战斗信息
    expect(screen.queryByRole("dialog", { name: "副本操作" })).not.toBeInTheDocument();
  });

  it("「战斗信息」不挑 phase：还没开始（第 0 回合）时 ⚙ 菜单里就有这一行", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 还没开始（已自动初始化、0 回合）：仍然能从菜单开战斗信息
    expect(await screen.findByRole("button", { name: "开始!" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /副本操作/ }));
    const menu = await screen.findByRole("dialog", { name: "副本操作" });
    expect(within(menu).getByRole("button", { name: "战斗信息" })).toBeInTheDocument();
  });

  it("自动初始化失败：显示原因，点「开始」可重试", async () => {
    server.use(
      instantTasks(),
      http.post(api("/api/dungeon/combat/init/v1/"), () =>
        HttpResponse.json({ detail: "mock 初始化失败" }, { status: 500 }),
      ),
    );
    renderCombatRoom();

    // 自动初始化失败 → 直接显示错误行（不需要点任何东西）
    expect(await screen.findByText(/开始战斗失败/)).toBeInTheDocument();
    // 还没进回合（draw 不会在 init 失败后补发）
    expect(screen.queryByRole("button", { name: "过牌（结束回合）" })).not.toBeInTheDocument();
    // 同一颗按钮就是重试入口
    expect(screen.getByRole("button", { name: "开始!" })).toBeEnabled();
  });

  it("开始后进入玩家回合：显示手牌、能量与过牌按钮", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    const hand = await screen.findByRole("list", { name: "手牌" });
    expect(within(hand).getByText("剖棺")).toBeInTheDocument();
    expect(within(hand).getByText("屏息")).toBeInTheDocument();
    // 行动者资源（能量 / 总格挡）与过牌按钮
    expect(screen.getByRole("list", { name: "行动者资源" })).toHaveTextContent("能量");
    expect(screen.getByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
  });

  it("名单卡可点开角色信息；卡底按钮只给 [被动] / [塞牌] 数量，点开看手牌", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    // 卡底常驻按钮只给数量；怪物才多一项「[塞牌]」
    const paperHand = await screen.findByRole("button", { name: "查看手牌：纸人" });
    expect(paperHand).toHaveTextContent("[被动] 1");
    expect(paperHand).toHaveTextContent("[塞牌] 1");
    const corpseHand = screen.getByRole("button", { name: "查看手牌：棺中殭尸" });
    expect(corpseHand).toHaveTextContent("[被动] 1");
    expect(corpseHand).toHaveTextContent("[塞牌] 2");
    // 我方自己那格不出现「[塞牌]」
    expect(screen.getByRole("button", { name: "查看手牌：无名" })).not.toHaveTextContent("[塞牌]");

    // 整卡可点 → 角色信息
    fireEvent.click(screen.getByRole("button", { name: "查看角色：纸人" }));
    const info = await screen.findByRole("dialog", { name: "角色信息" });
    await within(info).findByText("属性");
    fireEvent.click(within(info).getByRole("button", { name: "关闭" }));

    // 卡底按钮 → 该角色手牌：不再在卡面上标「塞牌」（那是持有关系），卡面只标「可传递」属性；再点卡进三级详情
    fireEvent.click(corpseHand);
    const handDialog = await screen.findByRole("dialog", { name: "手牌" });
    expect(within(handDialog).getByText("棺中殭尸 · 共 5 张")).toBeInTheDocument();
    expect(within(handDialog).queryByText("[塞牌]")).not.toBeInTheDocument();
    expect(within(handDialog).getAllByText("可传递")).toHaveLength(2);
    // 手牌只显示"不是自己的"来源（剖棺 / 钉棺 来自我方），自己的 / 空来源不显示
    expect(within(handDialog).getAllByText("来源：角色.无名")).toHaveLength(2);
    // 卡面词缀是一枚标记（`[入木]`），点开才看全文
    expect(within(handDialog).getByRole("button", { name: "[入木]" })).toBeInTheDocument();
    fireEvent.click(within(handDialog).getByRole("button", { name: "查看卡牌：钉棺" }));
    expect(await screen.findByRole("dialog", { name: "卡牌" })).toBeInTheDocument();
  });

  it("出牌：点手牌选中 → 点名单里的目标 → 点「出牌」确认（记录改在 ⚙ 战斗信息里看）", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    const hand = await screen.findByRole("list", { name: "手牌" });
    fireEvent.click(within(cardTileOf("剖棺")).getByRole("button", { name: "选中手牌：剖棺" }));
    // 选中后名单进入「选目标」态：整卡可点；点一张 = **只选目标**（不直接出牌）
    fireEvent.click(screen.getByRole("button", { name: "选择目标：纸人" }));
    // 两次选择都齐了，才长出「出牌」确认钮
    fireEvent.click(screen.getByRole("button", { name: "出牌" }));

    // 出牌成功 → 该卡离开手牌
    await waitFor(() => expect(within(hand).queryByText("剖棺")).not.toBeInTheDocument());

    // 本次出牌的 log 仍可从 ⚙「战斗信息」查看（页面上不再常驻回合记录）
    fireEvent.click(screen.getByRole("button", { name: /副本操作/ }));
    const menu = await screen.findByRole("dialog", { name: "副本操作" });
    fireEvent.click(within(menu).getByRole("button", { name: "战斗信息" }));
    const info = await screen.findByRole("dialog", { name: "战斗信息" });
    expect(within(info).getByText(/使用『剖棺』对 怪物.纸人/)).toBeInTheDocument();
  });

  it("选牌/选目标都要两次：手牌上移、目标下移，再点各自缩回去；两次都齐才出现「出牌」", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    await screen.findByRole("list", { name: "手牌" });
    const cardTile = cardTileOf("剖棺");
    // 只选了牌（上移）还没选目标：只给提示，没有「出牌」
    fireEvent.click(within(cardTile).getByRole("button", { name: "选中手牌：剖棺" }));
    expect(cardTile).toHaveClass("card-tile--selected");
    expect(screen.queryByRole("button", { name: "出牌" })).not.toBeInTheDocument();

    // 选目标（下移）→ 才长出「出牌」
    fireEvent.click(screen.getByRole("button", { name: "选择目标：纸人" }));
    const paper = screen.getByRole("button", { name: "选择目标：纸人" }).closest("li");
    expect(paper).toHaveClass("combatant-card--target");
    expect(screen.getByRole("button", { name: "出牌" })).toBeInTheDocument();

    // 再点同一张目标 → 缩回去，「出牌」也收回
    fireEvent.click(screen.getByRole("button", { name: "选择目标：纸人" }));
    expect(paper).not.toHaveClass("combatant-card--target");
    expect(screen.queryByRole("button", { name: "出牌" })).not.toBeInTheDocument();

    // 再点手牌 → 取消选中
    fireEvent.click(within(cardTile).getByRole("button", { name: "取消选中：剖棺" }));
    expect(cardTile).not.toHaveClass("card-tile--selected");
  });

  it("自身牌：选中就把自己那张压下去（自动目标），不用再点名单就能「出牌」", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    const hand = await screen.findByRole("list", { name: "手牌" });
    fireEvent.click(within(cardTileOf("屏息")).getByRole("button", { name: "选中手牌：屏息" }));

    // 自己那张（当前行动者）自动下移，不需要去名单里点
    expect(currentCombatant()).toHaveClass("combatant-card--target");
    expect(screen.getByRole("button", { name: "出牌" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "出牌" }));
    await waitFor(() => expect(within(hand).queryByText("屏息")).not.toBeInTheDocument());
  });

  it("出牌条：提示折行收在一块矩形里，两颗确认是与「回到地图」同族的卡状按钮", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    // 还没选牌：只有一句说明，不给卡状按钮
    expect(screen.getByText("点一张手牌开始出牌。")).toHaveClass("combat-hand-note");

    fireEvent.click(within(cardTileOf("剖棺")).getByRole("button", { name: "选中手牌：剖棺" }));
    // 只选了牌、还没选目标：「出牌」还没长出，只有「取消」
    expect(screen.queryByRole("button", { name: "出牌" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toHaveClass(
      "combat-hand-btn",
      "combat-hand-btn--cancel",
    );

    fireEvent.click(screen.getByRole("button", { name: "选择目标：纸人" }));
    const play = screen.getByRole("button", { name: "出牌" });
    // 卡状按钮 = 图标（装饰，不进无障碍名字）+ 词；「出牌」是主行动（绿）
    expect(play).toHaveClass("combat-hand-btn", "combat-hand-btn--play");
    expect(within(play).getByText("出牌")).toHaveClass("combat-hand-btn-caption");
    // 「已选 / 目标」那段话折行收在同一个矩形块里
    expect(screen.getByText(/目标：纸人/)).toHaveClass("combat-hand-hint");
  });

  it("all / spread：选一个锚点 = 整阵营都压下；spread 的提示多一句「随机」", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    const monsters = ["纸人", "棺中殭尸", "纸傀儡", "吊死鬼"];
    const targetTiles = () =>
      monsters.map((name) =>
        screen.getByRole("button", { name: `选择目标：${name}` }).closest("li"),
      );

    // all（摇铃）：点一个锚点 → 敌方**整阵营**都压下
    fireEvent.click(within(cardTileOf("摇铃")).getByRole("button", { name: "选中手牌：摇铃" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：纸人" }));
    for (const tile of targetTiles()) {
      expect(tile).toHaveClass("combatant-card--target");
    }
    // 我方不被选中；提示把整个阵营列出来
    expect(currentCombatant()).not.toHaveClass("combatant-card--target");
    expect(screen.getByText(/目标：纸人、棺中殭尸、纸傀儡、吊死鬼/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    // spread（照妖镜）：选中集合与 all 相同，只在提示里多一句随机
    fireEvent.click(within(cardTileOf("照妖镜")).getByRole("button", { name: "选中手牌：照妖镜" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：棺中殭尸" }));
    for (const tile of targetTiles()) {
      expect(tile).toHaveClass("combatant-card--target");
    }
    expect(screen.getByText(/在以上目标中随机/)).toBeInTheDocument();
  });

  it("过牌推进到怪物；四只怪物推完后回到开始新回合", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    // 我方过牌 → 轮到第一个怪物（名单的「当前行动」标记从无名换到纸人）
    fireEvent.click(await screen.findByRole("button", { name: "过牌（结束回合）" }));
    await waitFor(() => expect(within(currentCombatant()).getByText("纸人")).toBeInTheDocument());

    // 依次推完四只怪物：等行动者真的换了再点下一颗，避免点到忙碌中的按钮
    for (const name of ["棺中殭尸", "纸傀儡", "吊死鬼"]) {
      fireEvent.click(screen.getByRole("button", { name: "推进怪物回合" }));
      await waitFor(() => expect(within(currentCombatant()).getByText(name)).toBeInTheDocument());
    }

    // 最后一只推完 → 全员行动完，回准备屏（已有回合 → 按钮改成「开始新回合」）
    fireEvent.click(screen.getByRole("button", { name: "推进怪物回合" }));
    expect(await screen.findByRole("button", { name: "开始新回合" })).toBeInTheDocument();
  });

  it("结算：显示胜负、战利品与收取按钮，怪物标记战死", async () => {
    // 直接预置结算态，不必把整场战斗打一遍
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    expect(await screen.findByText("🏆 战斗胜利！")).toBeInTheDocument();
    // 参战者快照要等 details 回来，战利品才会出现；用 find 等它
    expect(await screen.findByRole("button", { name: "收取战利品（1）" })).toBeEnabled();
    // 战利品走 ItemRow：显示名 + 数量后缀 + 中文类型
    expect(screen.getByText("腐骨 ×2")).toBeInTheDocument();
    expect(screen.getByText("材料")).toBeInTheDocument();
    // 四只怪物都已战死
    expect(screen.getAllByText("已战死")).toHaveLength(4);
  });

  it("结算：收取战利品后列表清空、按钮禁用", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "收取战利品（1）" }));

    expect(await screen.findByText("（本场战斗没有战利品，或已收取）")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收取战利品（0）" })).toBeDisabled();
  });

  it("结算：这是最后一间，结束本间 = 直接离开副本回家园（不再绕一次地图）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    // 落点要看 `/state`（有没有下一间），所以等标题把进度显出来（标题与判据用的是同一个查询）
    await screen.findByRole("heading", { name: "荒村义庄 (2/2) 停柩房" });
    fireEvent.click(await screen.findByRole("button", { name: "结束本次战斗" }));

    // 本间之后没有房间了：服务端推进必然拒绝（"副本已全部通关"），所以直接走退出那条路。
    // 中间不再停一次地图——那一屏此刻没有任何可做的事。
    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "地图" })).not.toBeInTheDocument();
  });

  it("结算：未收的战利品只提示不阻止（「!」长在收取按钮上，后果在 title 里）", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    const collect = await screen.findByRole("button", { name: "收取战利品（1）" });
    expect(collect).toHaveClass("button--pending");
    expect(collect).toHaveAttribute("title", "结束本间后就无法再收了。");
    // 同一件事也做到标题行那颗「结束本间」上（与开场房同一套）
    const finish = screen.getByRole("button", { name: "结束本次战斗" });
    expect(finish).toHaveClass("icon-button--warn");
    expect(finish).toHaveAttribute(
      "title",
      "结束本次战斗（离开副本）—— 还有战利品未收取，结束本间后就无法再收了。",
    );
    expect(finish).toBeEnabled();
  });

  it("战利品收完之后：标题行那颗「结束本间」的提醒色消失", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "收取战利品（1）" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "结束本次战斗" })).not.toHaveClass(
        "icon-button--warn",
      ),
    );
  });
});
