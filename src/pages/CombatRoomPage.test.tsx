import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  drawMockCards,
  initMockCombat,
  passMockTurn,
  prepareMockDefeat,
  prepareMockPostCombat,
} from "../mocks/combat";
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
  enterMockDungeon("副本.荒废地窟");
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

/** 出牌条（中间那条）：卡面上也有同名词（如「不可出牌」chip），查询要限定在这里。 */
function handBar(): HTMLElement {
  const bar = document.querySelector(".combat-hand-bar");
  if (!(bar instanceof HTMLElement)) {
    throw new Error("页面上没有出牌条");
  }
  return bar;
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
  it("角色卡：进房那一屏与 turn 名单卡是同一副《怪物火车》牌面（立绘 + 四角数值）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 进房那一屏：上下两排也是同一副牌面——外/内框 + 立绘区 + 名字横幅 + 底排（盾 / 定性 / 心）
    const monsterCard = (await screen.findByText("石像鬼")).closest("article");
    if (!(monsterCard instanceof HTMLElement)) {
      throw new Error("进房那一屏没有石像鬼那张卡");
    }
    expect(monsterCard).toHaveClass("combatant-card", "actor-card");
    expect(monsterCard.querySelector(".combatant-art")).toBeInTheDocument();
    expect(monsterCard.querySelector(".combatant-chip--hp")).toHaveTextContent("9");
    // HP 只显当前值，全长挂在悬停说明上
    expect(monsterCard.querySelector(".combatant-chip--hp")).toHaveAttribute("title", "HP 9/9");
    expect(monsterCard.querySelector(".combatant-role")).toHaveTextContent("怪物");
    // 进房那一屏**没有词条区**（立绘区吃满剩余高度），攻 / 防 / 速也不在卡上；也没有能量徽
    expect(monsterCard.querySelector(".combatant-keywords")).toBeNull();
    expect(monsterCard.querySelector(".combatant-chip--energy")).toBeNull();
    expect(screen.queryByText(/attack 3/)).not.toBeInTheDocument();

    // 开打后：名单卡同一副牌面，只是多出词条区
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });
    const roster = screen.getByRole("list", { name: "参战者" });
    const youCard = within(roster).getByText("无名").closest("li");
    if (!(youCard instanceof HTMLElement)) {
      throw new Error("名单里没有玩家那张卡");
    }
    // 左上能量（圆徽，与手牌的费用同一造型，读 `RoundStatsComponent`）/ 左下总格挡（盾）/ 右下 HP（心）
    expect(youCard.querySelector(".combatant-chip--energy")).toHaveTextContent("3");
    expect(youCard.querySelector(".combatant-chip--energy")).toHaveAttribute("title", "能量");
    expect(youCard.querySelector(".combatant-chip--block")).toHaveTextContent("6");
    expect(youCard.querySelector(".combatant-chip--hp")).toHaveTextContent("12");
    expect(youCard.querySelector(".combatant-role")).toHaveTextContent("玩家");
    // 当前行动并进名字横幅
    expect(youCard.querySelector(".combatant-name-state--current")).toHaveTextContent("当前行动");
    // 中段立绘区先空着（占位）
    expect(youCard.querySelector(".combatant-art")).toBeInTheDocument();

    // 我方不再标「你」，但怪物定性仍写「怪物」（正下那排）
    expect(within(youCard).queryByText("你")).not.toBeInTheDocument();
    expect(within(roster).getAllByText("怪物")).toHaveLength(3);

    // 词条区那颗按钮：手牌 / 被动 / 塞牌（我方也照样有 [塞牌]，只是为 0），点开看手牌
    const handButton = within(youCard).getByRole("button", { name: "查看手牌：无名" });
    expect(handButton).toHaveTextContent("[手牌] 5");
    expect(handButton).toHaveTextContent("[被动] 0");
    expect(handButton).toHaveTextContent("[塞牌] 0");
  });

  it("进房那一屏：敌人在上、我方在下，「开始」夹在中间；没有场景描述", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 一列三段：敌人 → 开始 → 我方（顺序就是屏幕上从上到下）
    const enemies = await screen.findByRole("region", { name: "敌人" });
    // 「开始」要等自动初始化落地才从「准备中…」变成它
    const start = await screen.findByRole("button", { name: "开始!" });
    const party = screen.getByRole("region", { name: "队伍" });
    expect(enemies.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(start.compareDocumentPosition(party) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(start).toHaveClass("combat-start");
    expect(start.closest(".combat-field-center")).not.toBeNull();

    // 上下两排共用同一套排法（一个类，居中 + 横滑都写在它上面；实际几何 jsdom 量不到）
    expect(enemies).toHaveClass("cards", "cards--party");
    expect(party).toHaveClass("cards", "cards--party");
    // 上排最多 3 只怪——卡是异步读来的，等到齐
    expect(await within(enemies).findAllByText("怪物")).toHaveLength(3);
    // 测试里名单为空 → 队伍只有玩家自己（3v3 的另一个 3 由名单提供）
    expect(await within(party).findAllByText("玩家")).toHaveLength(1);

    // 场景描述整块下线（战斗房里不再有这条入口）
    expect(screen.queryByRole("region", { name: "场景描述" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /查看场景/ })).not.toBeInTheDocument();
  });

  it("进入战斗房间是进房那一屏：先摆对阵，开始后落到玩家回合", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 战斗房间正文起来了（页面不再有可见标题，拿「副本操作」入口当落地锚）
    expect(await screen.findByRole("button", { name: /副本操作/ })).toBeInTheDocument();
    // 进入战斗房间自动初始化；成功后开局前唯一的动作是「开始」（旧的第一回合引导句已移除）
    expect(await screen.findByRole("button", { name: "开始!" })).toBeInTheDocument();
    expect(screen.queryByText(/抓牌以开启第一回合/)).not.toBeInTheDocument();
    // 参战者：队友不入队时只有玩家 + 三个怪物
    expect(await screen.findByText("石像鬼")).toBeInTheDocument();
    expect(screen.getByText("腐沼巨蜥")).toBeInTheDocument();
    expect(screen.getAllByText("怪物")).toHaveLength(3);

    // 开始 = 抓牌：直接落到玩家回合（第一回合有了；初始化是自动跑的）
    fireEvent.click(screen.getByRole("button", { name: "开始!" }));
    expect(await screen.findByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
  });

  it("进房那一屏：队伍卡整卡可点开角色信息（副本内无时装入口）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    fireEvent.click(await screen.findByRole("button", { name: "查看角色：无名" }));
    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    await within(dialog).findByText("属性");
    // 副本进行中家园接口会被拒，所以隐藏时装区
    expect(within(dialog).queryByRole("heading", { name: "时装" })).not.toBeInTheDocument();
  });

  it("进房那一屏：敌人卡也能点开（怪物与队伍成员挂同一套组件，外观同样来自 AppearanceComponent）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    fireEvent.click(await screen.findByRole("button", { name: "查看角色：石像鬼" }));
    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    await within(dialog).findByText("属性");
    expect(within(dialog).getByText("hp")).toBeInTheDocument();
    expect(within(dialog).getByText("max_hp")).toBeInTheDocument();
    expect(within(dialog).getAllByText("9")).toHaveLength(2);
    // 外观来自 AppearanceComponent：初始「当前」=「基础」（怪物不穿时装，真实后端也如此）
    expect(within(dialog).getAllByText(/赤红的石眼/)).toHaveLength(2);
  });

  it("共同框架在战斗房间同样给出三个平级入口（副本操作 / 地图 / 牌组）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    await screen.findByRole("button", { name: /副本操作/ });
    expect(screen.getByRole("button", { name: "地图" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "牌组" }));
    const list = await screen.findByRole("dialog", { name: "牌组一览" });
    // 我方：队友没入队时名单里只有玩家（牌组是点开才拉的，所以要等）
    expect(await within(list).findByRole("heading", { name: "我方" })).toBeInTheDocument();
    expect(await within(list).findByRole("button", { name: /无名/ })).toHaveTextContent("玩家");

    // 敌方：本间（地窟深处）的怪物与我方同列，且持有牌组
    expect(await within(list).findByRole("heading", { name: "敌方" })).toBeInTheDocument();
    const paper = await within(list).findByRole("button", { name: /石像鬼/ });
    expect(paper).toHaveTextContent("怪物");
    expect(within(list).getByRole("button", { name: /腐沼巨蜥/ })).toHaveTextContent("怪物");

    // 怪物也能点进二级看牌组（怪物同样持 DeckComponent）
    fireEvent.click(paper);
    const deck = await screen.findByRole("dialog", { name: "牌组" });
    expect(within(deck).getByText("石像鬼 · 共 5 张")).toBeInTheDocument();
    // 牌组一律不显示来源（牌必属持有者），即使 mock 里混了别家的牌
    expect(within(deck).queryByText(/来源：/)).not.toBeInTheDocument();
  });

  it("战斗的宏观状态收在 ⚙「副本操作」里：一行「战斗信息」写着状态 / 回合 / 结果，点开看全部回合", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 自动初始化后点开始抓牌，开第一回合，让「战斗信息」有真正的回合数据
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByText("劈斩");

    fireEvent.click(screen.getByRole("button", { name: /副本操作/ }));
    const menu = await screen.findByRole("dialog", { name: "副本操作" });
    const entry = within(menu).getByRole("button", { name: "战斗信息" });
    // 行尾就是那排 chip 的浓缩：状态 / 回合 / 结果
    expect(entry.parentElement).toHaveTextContent("进行中 · 第 1 回合 · 结果 —");

    fireEvent.click(entry);
    const combatInfo = await screen.findByRole("dialog", { name: "战斗信息" });
    // 宏观三块：状态事实 / 双方参战者 / 全部回合。快照要等 details，所以名单用 find
    expect(within(combatInfo).getByText("状态").nextElementSibling).toHaveTextContent("进行中");
    expect(await within(combatInfo).findByRole("heading", { name: "我方" })).toBeInTheDocument();
    expect(within(combatInfo).getByRole("heading", { name: "敌方" })).toBeInTheDocument();
    // 宏观名单只要名字 + 生死：不铺血量 / 能量 / 牌堆那套（那是行动面板的事）
    expect(within(combatInfo).getByText("腐沼巨蜥")).toBeInTheDocument();
    expect(within(combatInfo).queryByText(/hp /)).not.toBeInTheDocument();
    // 还没打：一个「已战死」都没有
    expect(within(combatInfo).queryByText("已战死")).not.toBeInTheDocument();
    // 当前谁在行动不在名单上标——下面「全部回合」里那条 `当前行动` 就是唯一一处（一样的信息不说两遍）
    const party = within(combatInfo).getByRole("heading", { name: "我方" });
    expect(party.parentElement?.querySelector(".badge--current")).toBeNull();
    expect(within(combatInfo).getAllByText("当前行动")).toHaveLength(1);
    // 全部回合的 Round 明细（第 N 回合 + 行动顺序等）
    expect(within(combatInfo).getByText(/第 1 回合/)).toBeInTheDocument();
    expect(within(combatInfo).getByText("行动顺序")).toBeInTheDocument();

    // 同类切换不叠层：菜单已关，只剩战斗信息
    expect(screen.queryByRole("dialog", { name: "副本操作" })).not.toBeInTheDocument();
  });

  it("战斗信息：结算后名单还在，战死的怪物挂「已战死」（宏观看的是「谁还活着」，不筛掉死者）", async () => {
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    await screen.findByText("🏆 战斗胜利！");
    fireEvent.click(screen.getByRole("button", { name: /副本操作/ }));
    const menu = await screen.findByRole("dialog", { name: "副本操作" });
    fireEvent.click(within(menu).getByRole("button", { name: "战斗信息" }));
    const info = await screen.findByRole("dialog", { name: "战斗信息" });

    // 我方一个没死、敌方三只全死——一眼读出战果
    const party = await within(info).findByRole("heading", { name: "我方" });
    expect(party.parentElement).not.toHaveTextContent("已战死");
    const monsters = within(info).getByRole("heading", { name: "敌方" });
    expect(monsters.parentElement?.querySelectorAll(".badge--dead")).toHaveLength(3);
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
    expect(within(hand).getByText("劈斩")).toBeInTheDocument();
    expect(within(hand).getByText("静默")).toBeInTheDocument();
    // 行动者资源（能量 / 总格挡）与过牌按钮
    expect(screen.getByRole("list", { name: "行动者资源" })).toHaveTextContent("能量");
    expect(screen.getByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
  });

  it("名单卡可点开角色信息；词条按钮给 [被动] / [塞牌] 数量，点开看手牌", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    // 词条区那颗按钮给被动 / 塞牌计数；被塞牌不分阵营（我这格没人塞就是 0，怪物手上来自我方的牌标出来）
    const paperHand = await screen.findByRole("button", { name: "查看手牌：石像鬼" });
    expect(paperHand).toHaveTextContent("[被动] 1");
    expect(paperHand).toHaveTextContent("[塞牌] 1");
    const corpseHand = screen.getByRole("button", { name: "查看手牌：腐沼巨蜥" });
    expect(corpseHand).toHaveTextContent("[被动] 1");
    expect(corpseHand).toHaveTextContent("[塞牌] 2");
    // 我方自己那格计数照样在，只是没有人塞牌 → 0
    expect(screen.getByRole("button", { name: "查看手牌：无名" })).toHaveTextContent("[塞牌] 0");

    // 整卡可点 → 角色信息
    fireEvent.click(screen.getByRole("button", { name: "查看角色：石像鬼" }));
    const info = await screen.findByRole("dialog", { name: "角色信息" });
    await within(info).findByText("属性");
    fireEvent.click(within(info).getByRole("button", { name: "关闭" }));

    // 卡底按钮 → 该角色手牌：不再在卡面上标「塞牌」（那是持有关系），卡面只标「可传递」属性；再点卡进三级详情
    fireEvent.click(corpseHand);
    const handDialog = await screen.findByRole("dialog", { name: "手牌" });
    expect(within(handDialog).getByText("腐沼巨蜥 · 共 5 张")).toBeInTheDocument();
    expect(within(handDialog).queryByText("[塞牌]")).not.toBeInTheDocument();
    expect(within(handDialog).getAllByText("可传递")).toHaveLength(2);
    // 手牌只显示"不是自己的"来源（劈斩 / 钉入 来自我方），自己的 / 空来源不显示。
    // 来源是名字横幅里的 pill，且剥掉 `角色.` 前缀（`displayName`）。
    expect(within(handDialog).getAllByText("来源：无名")).toHaveLength(2);
    // 卡面词缀是一枚标记（`[楔入]`），点开才看全文
    expect(within(handDialog).getByRole("button", { name: "[楔入]" })).toBeInTheDocument();
    fireEvent.click(within(handDialog).getByRole("button", { name: "查看卡牌：钉入" }));
    expect(await screen.findByRole("dialog", { name: "卡牌" })).toBeInTheDocument();
  });

  it("出牌：点手牌选中 → 点名单里的目标 → 点「出牌」确认（记录改在 ⚙ 战斗信息里看）", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    const hand = await screen.findByRole("list", { name: "手牌" });
    fireEvent.click(within(cardTileOf("劈斩")).getByRole("button", { name: "选中手牌：劈斩" }));
    // 选中后名单进入「选目标」态：整卡可点；点一张 = **只选目标**（不直接出牌）
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    // 两次选择都齐了，才把「出牌」转正
    fireEvent.click(screen.getByRole("button", { name: "出牌" }));

    // 出牌成功 → 该卡离开手牌
    await waitFor(() => expect(within(hand).queryByText("劈斩")).not.toBeInTheDocument());

    // 本次出牌的 log 仍可从 ⚙「战斗信息」查看（页面上不再常驻回合记录）
    fireEvent.click(screen.getByRole("button", { name: /副本操作/ }));
    const menu = await screen.findByRole("dialog", { name: "副本操作" });
    fireEvent.click(within(menu).getByRole("button", { name: "战斗信息" }));
    const info = await screen.findByRole("dialog", { name: "战斗信息" });
    expect(within(info).getByText(/使用『劈斩』对 怪物.石像鬼/)).toBeInTheDocument();
  });

  it("选牌/选目标都要两次：手牌上移、目标下移，再点各自缩回去；两次都齐「出牌」才转正", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    await screen.findByRole("list", { name: "手牌" });
    const cardTile = cardTileOf("劈斩");
    // 只选了牌（上移）还没选目标：「出牌」原位不动，只是灰成「选择目标」
    fireEvent.click(within(cardTile).getByRole("button", { name: "选中手牌：劈斩" }));
    expect(cardTile).toHaveClass("card-tile--selected");
    expect(screen.getByRole("button", { name: "选择目标" })).toBeDisabled();

    // 选目标（下移）→ 同一颗按钮才转正
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    const paper = screen.getByRole("button", { name: "选择目标：石像鬼" }).closest("li");
    expect(paper).toHaveClass("combatant-card--target");
    expect(screen.getByRole("button", { name: "出牌" })).toBeEnabled();

    // 再点同一张目标 → 缩回去，「出牌」跟着退回灰态
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    expect(paper).not.toHaveClass("combatant-card--target");
    expect(screen.getByRole("button", { name: "选择目标" })).toBeDisabled();

    // 再点手牌 → 取消选中
    fireEvent.click(within(cardTile).getByRole("button", { name: "取消选中：劈斩" }));
    expect(cardTile).not.toHaveClass("card-tile--selected");
  });

  it("自身牌：选中就把自己那张压下去（自动目标），不用再点名单就能「出牌」", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    const hand = await screen.findByRole("list", { name: "手牌" });
    fireEvent.click(within(cardTileOf("静默")).getByRole("button", { name: "选中手牌：静默" }));

    // 自己那张（当前行动者）自动下移，不需要去名单里点
    expect(currentCombatant()).toHaveClass("combatant-card--target");
    expect(screen.getByRole("button", { name: "出牌" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "出牌" }));
    await waitFor(() => expect(within(hand).queryByText("静默")).not.toBeInTheDocument());
  });

  it("能量不够的卡：「出牌」同样灰掉（扣能量后剩余不够，与不可出牌同一副待遇）", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    // 镜光费用 2（本回合能量 3）→ 打掉它，能量就只剩 1
    fireEvent.click(within(cardTileOf("镜光")).getByRole("button", { name: "选中手牌：镜光" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    fireEvent.click(screen.getByRole("button", { name: "出牌" }));

    // 等快照刷新：镜光离手（同一份快照里的能量也变成 1 了）
    const hand = screen.getByRole("list", { name: "手牌" });
    await waitFor(() => expect(within(hand).queryByText("镜光")).not.toBeInTheDocument());
    expect(
      within(screen.getByRole("list", { name: "行动者资源" })).getByText("能量"),
    ).toBeInTheDocument();
    expect(document.querySelector(".res--energy .res-gem")).toHaveTextContent("1");

    // 战吼费用 2 > 剩余 1：两次选择照旧能选，但「出牌」按不下去、理由**直接写在字上**
    fireEvent.click(within(cardTileOf("战吼")).getByRole("button", { name: "选中手牌：战吼" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    const play = screen.getByRole("button", { name: "能量不足" });
    expect(play).toBeDisabled();
    expect(play).toHaveClass("combat-hand-btn--off");
    expect(within(play).getByText("⊘")).toBeInTheDocument();
    // 「灰掉」+ 字面上的理由就够，不再另给一句提示（数值在卡上的「费用」与右列的能量圆钮里）
    expect(play).not.toHaveAttribute("title");
  });

  it("出牌条：卡的信息与「查看详情」合成一颗按钮（两行），三块常驻、位置不跳", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    // 还没选牌：只有一句说明，不给卡状按钮
    expect(screen.getByText("点一张手牌开始出牌。")).toHaveClass("combat-hand-note");

    fireEvent.click(within(cardTileOf("劈斩")).getByRole("button", { name: "选中手牌：劈斩" }));
    // 只选了牌、还没选目标：三块就都在了，只是「出牌」灰成「选择目标」
    const info = screen.getByRole("button", { name: "查看卡牌详情：劈斩" });
    expect(info).toHaveClass("combat-hand-info");
    // 两行：已选一行、目标一行；那句“点上方角色选择目标”不再出现
    expect(within(info).getByText("已选：劈斩")).toBeInTheDocument();
    expect(within(info).getByText("目标：未选择")).toBeInTheDocument();
    expect(screen.queryByText(/点上方角色/)).not.toBeInTheDocument();
    const waiting = screen.getByRole("button", { name: "选择目标" });
    expect(waiting).toBeDisabled();
    expect(waiting).toHaveClass("combat-hand-btn", "combat-hand-btn--play", "combat-hand-btn--off");
    expect(screen.getByRole("button", { name: "取消" })).toHaveClass(
      "combat-hand-btn",
      "combat-hand-btn--cancel",
    );

    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    // 目标齐了：「出牌」转正（绿框、可点），信息那块第二行跟着换
    const play = screen.getByRole("button", { name: "出牌" });
    expect(play).toHaveClass("combat-hand-btn", "combat-hand-btn--play");
    expect(play).not.toHaveClass("combat-hand-btn--off");
    expect(within(play).getByText("出牌")).toHaveClass("combat-hand-btn-caption");
    expect(within(info).getByText("目标：石像鬼")).toBeInTheDocument();

    // 点信息那块 = 看详情（手牌里整卡点击是「选中」，详情只走这一颗）
    fireEvent.click(info);
    expect(await screen.findByRole("dialog", { name: "卡牌" })).toBeInTheDocument();
  });

  it("不可出牌的卡：两次选择照旧，但「出牌」灰掉 + 换禁行图标（信息 / 取消还在）", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    // 常驻符文在 mock 里就是 `playable: false`（卡面挂着灰标记「不可出牌」）
    fireEvent.click(
      within(cardTileOf("常驻符文")).getByRole("button", { name: "选中手牌：常驻符文" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));

    // 「出牌」还在原位、形状不变，只是按不下去：禁行图标 + **字面上就写着为什么**
    // （卡面上也有同名的「不可出牌」chip，所以要限定在出牌条里找）
    const play = within(handBar()).getByRole("button", { name: "不可出牌" });
    expect(play).toBeDisabled();
    expect(play).toHaveClass("combat-hand-btn", "combat-hand-btn--play", "combat-hand-btn--off");
    expect(within(play).getByText("⊘")).toHaveClass("combat-hand-btn-glyph");
    expect(play).toHaveAttribute("title", "这张牌写着不可出牌（卡面那枚灰标记）");

    // 只灰主行动：取消与信息那块照旧可用（所以还退得出去、也看得清为什么不能打）
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
    const info = screen.getByRole("button", { name: "查看卡牌详情：常驻符文" });
    expect(info).toBeEnabled();
    fireEvent.click(info);
    expect(await screen.findByRole("dialog", { name: "卡牌" })).toBeInTheDocument();
  });

  it("手牌：点词缀只弹说明浮层；整卡点击是「选中」，看详情要走中间那块卡信息", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    // 点词缀 chip = 问“这是什么”：弹一枚小浮层，不开详情（与牌组里整卡直开详情不同，
    // 因为手牌里整卡点击有别的含义——选中待出）
    fireEvent.click(within(cardTileOf("劈斩")).getByRole("button", { name: "[破壳]" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("命中后可以再摸一张");
    expect(screen.queryByRole("dialog", { name: "卡牌" })).not.toBeInTheDocument();
    fireEvent.mouseDown(document.body);

    // 整卡点击 = 选中：中间那条长出按钮，同样不开详情
    fireEvent.click(within(cardTileOf("劈斩")).getByRole("button", { name: "选中手牌：劈斩" }));
    expect(screen.queryByRole("dialog", { name: "卡牌" })).not.toBeInTheDocument();

    // 信息那块是手牌里进详情的唯一入口；详情两栏：左卡面 / 右全文
    fireEvent.click(screen.getByRole("button", { name: "查看卡牌详情：劈斩" }));
    const detail = await screen.findByRole("dialog", { name: "卡牌" });
    expect(within(detail).getByRole("list", { name: "卡面" })).toBeInTheDocument();
    expect(within(detail).getByText(/命中后可以再摸一张/)).toBeInTheDocument();
  });

  it("长牌组（15 张）：列表浮窗尺寸不跟着卡数走，超出的牌靠框内滚动看", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 腐沼巨蜥的牌组在 mock 里被加到 15 张（5 行），专门用来碰「固定三行」那条线
    fireEvent.click(await screen.findByRole("button", { name: "牌组" }));
    const list = await screen.findByRole("dialog", { name: "牌组一览" });
    fireEvent.click(await within(list).findByRole("button", { name: /腐沼巨蜥/ }));

    const deck = await screen.findByRole("dialog", { name: "牌组" });
    expect(within(deck).getByText("腐沼巨蜥 · 共 15 张")).toBeInTheDocument();
    // 关键：**全部 15 张都在 DOM 里**——三行高是「视口」而不是截断（jsdom 量不到滚动条，
    // 所以这一层能验的就是「没把超出的卡丢掉」，滚动的观感靠 `dev:mock` 手看）
    expect(within(deck).getAllByRole("listitem")).toHaveLength(15);
    // 固定尺寸与滚动都挂在这同一个类上，牌组 / 手牌 / 牌堆共用
    expect(within(deck).getByRole("list")).toHaveClass("card-tiles--deck");
  });

  it("轮到怪物：下半部只有一颗「怪物行动」，我方那套牌堆 / 手牌 / 能量都不出现", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    fireEvent.click(await screen.findByRole("button", { name: "过牌（结束回合）" }));
    await waitFor(() => expect(within(currentCombatant()).getByText("石像鬼")).toBeInTheDocument());

    // 上半部（名单）与我方一致：当前行动仍在名单上标出来
    expect(screen.getByRole("list", { name: "参战者" })).toBeInTheDocument();
    // 下半部不一样：只有一颗执行按钮，服务端替它决策
    const act = screen.getByRole("button", { name: "怪物行动" });
    expect(act).toHaveClass("combat-start");
    expect(act.closest(".combat-monster-turn")).not.toBeNull();
    // 我方那套操作区整块不出现（怪物没有"手牌 / 能量 / 牌堆"可操作）
    expect(screen.queryByRole("list", { name: "手牌" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "行动者资源" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "牌堆" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "过牌（结束回合）" })).not.toBeInTheDocument();
    // 基本信息照样能拿：点名单卡看角色信息，词条行看它的手牌
    expect(screen.getByRole("button", { name: "查看角色：石像鬼" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看手牌：石像鬼" })).toBeInTheDocument();
  });

  it("三个牌堆都是按钮：点开是这一摞的卡牌列表（与手牌 / 牌组同一个浮窗）", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    // 按钮就那么一颗（圆柱 + 名称），无障碍名里带着张数——不必先点开才知道有几张
    const drawButton = screen.getByRole("button", { name: "查看抽牌堆（4 张）" });
    expect(drawButton).toHaveClass("res", "res--pile");
    expect(drawButton.closest("li")).toHaveClass("combat-pile");

    // 无名 9 张牌抓走 5 张（`MOCK_DRAW_PER_TURN`），抽牌堆剩 4 张
    fireEvent.click(drawButton);
    const draw = await screen.findByRole("dialog", { name: "抽牌堆" });
    expect(within(draw).getByText("无名 · 共 4 张")).toBeInTheDocument();
    expect(within(draw).getAllByRole("listitem")).toHaveLength(4);
    // 与牌组 / 手牌共用一套卡面（行数封顶写在样式里，jsdom 量不到）
    expect(within(draw).getByRole("list")).toHaveClass("card-tiles--deck");
    // 牌堆也是「整卡点开三级详情」那一套
    fireEvent.click(within(draw).getByRole("button", { name: "查看卡牌：钉入" }));
    expect(await screen.findByRole("dialog", { name: "卡牌" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });

    // 空牌堆：给一句空态，而不是一片空白
    fireEvent.click(screen.getByRole("button", { name: "查看弃牌堆（0 张）" }));
    const discard = await screen.findByRole("dialog", { name: "弃牌堆" });
    expect(within(discard).getByText("（弃牌堆为空）")).toBeInTheDocument();
  });

  it("all / spread：选一个锚点 = 整阵营都压下；spread 的提示多一句「随机」", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    await screen.findByRole("list", { name: "手牌" });

    const monsters = ["石像鬼", "腐沼巨蜥", "提线木偶"];
    const targetTiles = () =>
      monsters.map((name) =>
        screen.getByRole("button", { name: `选择目标：${name}` }).closest("li"),
      );

    // all（战吼）：点一个锚点 → 敌方**整阵营**都压下
    fireEvent.click(within(cardTileOf("战吼")).getByRole("button", { name: "选中手牌：战吼" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    for (const tile of targetTiles()) {
      expect(tile).toHaveClass("combatant-card--target");
    }
    // 我方不被选中；提示把整个阵营列出来
    expect(currentCombatant()).not.toHaveClass("combatant-card--target");
    expect(screen.getByText(/目标：石像鬼、腐沼巨蜥、提线木偶/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    // spread（镜光）：选中集合与 all 相同，只在提示里多一句随机
    fireEvent.click(within(cardTileOf("镜光")).getByRole("button", { name: "选中手牌：镜光" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：腐沼巨蜥" }));
    for (const tile of targetTiles()) {
      expect(tile).toHaveClass("combatant-card--target");
    }
    expect(screen.getByText(/（随机命中）/)).toBeInTheDocument();
  });

  it("动作浮窗：按下就盖上并写明进行中（这一屏只看「进行中」那一态，不等结算）", async () => {
    // 直接造出"轮到怪物"的回合，不点任何按钮，也就不必等任务
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    initMockCombat();
    drawMockCards();
    passMockTurn();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "怪物行动" }));

    // mock 任务要跑 2 秒：这一屏只看浮窗开出来的那一态
    const report = await screen.findByRole("dialog", { name: "怪物行动" });
    expect(within(report).getByText("进行中")).toBeInTheDocument();
    expect(within(report).getByText(/服务端正在决策与结算/)).toBeInTheDocument();
  });

  it("动作浮窗：跑完换成这次新增的回合条目，「继续」收起", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    initMockCombat();
    drawMockCards();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "选中手牌：劈斩" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    fireEvent.click(within(handBar()).getByRole("button", { name: "出牌" }));

    const report = await screen.findByRole("dialog", { name: "出牌结算" });
    await waitFor(() => expect(within(report).getByText("已结算")).toBeInTheDocument());
    // 条目就是 `Round.entries` 新增的那几条：种类说法 + 数据日志 + 叙事
    // （标题也叫「出牌结算」，所以这里按条目的两段内容认，而不认标题那四个字）
    expect(within(report).getByText(/使用『劈斩』/)).toBeInTheDocument();
    expect(within(report).getByText(/打出『劈斩』，命中目标/)).toBeInTheDocument();

    fireEvent.click(within(report).getByRole("button", { name: "继续" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "出牌结算" })).not.toBeInTheDocument(),
    );
  });

  it("动作浮窗：过牌没有留下记录就自己收起，不额外要一次点击", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    initMockCombat();
    drawMockCards();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "过牌（结束回合）" }));
    expect(await screen.findByRole("dialog", { name: "过牌" })).toBeInTheDocument();

    // 等不到条目 → 收窗（宽限 1.2 秒，给足时间）
    await waitFor(
      () => expect(screen.queryByRole("dialog", { name: "过牌" })).not.toBeInTheDocument(),
      {
        timeout: 4000,
      },
    );
  });

  it("动作浮窗：动作失败时不弹条目，浮窗收起，原因留在按钮旁边", async () => {
    server.use(instantTasks());
    server.use(
      http.post(
        api("/api/dungeon/combat/play_cards/v1/"),
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    initMockCombat();
    drawMockCards();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "选中手牌：劈斩" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目标：石像鬼" }));
    fireEvent.click(within(handBar()).getByRole("button", { name: "出牌" }));

    expect(await screen.findByText(/回合动作失败/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "出牌结算" })).not.toBeInTheDocument();
  });

  it("过牌推进到怪物；全员行动完后自动开下一回合，玩家直接接着出牌", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    // 我方过牌 → 轮到第一个怪物（名单的「当前行动」标记从无名换到石像鬼）
    fireEvent.click(await screen.findByRole("button", { name: "过牌（结束回合）" }));
    await waitFor(() => expect(within(currentCombatant()).getByText("石像鬼")).toBeInTheDocument());

    // 依次推完剩下两只怪物：等行动者真的换了再点下一颗，避免点到忙碌中的按钮
    for (const name of ["腐沼巨蜥", "提线木偶"]) {
      fireEvent.click(screen.getByRole("button", { name: "怪物行动" }));
      await waitFor(() => expect(within(currentCombatant()).getByText(name)).toBeInTheDocument());
    }

    // 最后一只推完 → 全员行动完：客户端自动抓牌开第 2 回合，不停在"回合之间"、更没有按钮
    fireEvent.click(screen.getByRole("button", { name: "怪物行动" }));

    // 第 2 回合的第一个人又是玩家：动作区换成玩家的「过牌」（手牌也是这时才重新抓的）
    expect(await screen.findByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "手牌" })).toBeInTheDocument();
    expect(within(currentCombatant()).getByText("无名")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始新回合" })).not.toBeInTheDocument();
    expect(screen.queryByText("准备下一回合…")).not.toBeInTheDocument();
    // 仍停在行动面板（没有回到进房那一屏）
    expect(screen.queryByRole("region", { name: "对阵" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "回合行动" })).toBeInTheDocument();
  });

  it("自动开新回合失败：停在原地给「重试」，恢复后直接接上", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));
    fireEvent.click(await screen.findByRole("button", { name: "过牌（结束回合）" }));
    await waitFor(() => expect(within(currentCombatant()).getByText("石像鬼")).toBeInTheDocument());

    // 从这一刻起抓牌一律失败（第 1 回合已经开好了，只影响自动接上的那一回合）
    server.use(
      http.post(
        api("/api/dungeon/combat/draw_cards/v1/"),
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    for (const name of ["腐沼巨蜥", "提线木偶"]) {
      fireEvent.click(screen.getByRole("button", { name: "怪物行动" }));
      await waitFor(() => expect(within(currentCombatant()).getByText(name)).toBeInTheDocument());
    }
    fireEvent.click(screen.getByRole("button", { name: "怪物行动" }));

    // 自动抓牌失败：不静默卡住，给一行原因 + 一颗重试
    expect(await screen.findByText(/开始新回合失败/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();

    // 服务恢复后点重试：直接接上第 2 回合，仍是玩家先手
    server.resetHandlers();
    server.use(instantTasks());
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
    expect(screen.queryByText(/开始新回合失败/)).not.toBeInTheDocument();
  });

  it("结算：与进房那一屏同一套上下阵——敌人 / 中间结语与收取 / 我方", async () => {
    // 直接预置结算态，不必把整场战斗打一遍
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    const result = await screen.findByText("🏆 战斗胜利！");
    expect(result).toHaveClass("combat-result");
    // 参战者快照要等 details 回来，战利品按钮才会出现；用 find 等它
    const collect = await screen.findByRole("button", { name: "收取战利品（1）" });
    expect(collect).toBeEnabled();

    // 从上到下：敌人 → 结语 → 收取 → 我方（与进房那一屏同一条中线）
    const enemies = screen.getByRole("region", { name: "敌人" });
    const party = screen.getByRole("region", { name: "队伍" });
    expect(enemies.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(result.compareDocumentPosition(collect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(collect.compareDocumentPosition(party) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 战果就在卡上：三只怪全挂「已战死」并压暗，我方一个没死
    expect(await within(enemies).findAllByText("已战死")).toHaveLength(3);
    expect(within(party).queryByText("已战死")).not.toBeInTheDocument();
    expect(within(enemies).getAllByText("怪物")[0]?.closest("article")).toHaveClass(
      "combatant-card--dead",
    );
    // 参战者 / 本回合记录 / 战利品清单不再常驻结算页（改在 ⚙「战斗信息」等处查）
    expect(screen.queryByRole("heading", { name: "战利品" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "参战者" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本回合记录" })).not.toBeInTheDocument();
    expect(screen.queryByText("腐化兽骨 ×2")).not.toBeInTheDocument();
  });

  it("结算：入口先弹浮窗列出战利品，收取后才清空并关窗", async () => {
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    // 入口只打开浮窗，不直接收取
    fireEvent.click(await screen.findByRole("button", { name: "收取战利品（1）" }));
    const dialog = await screen.findByRole("dialog", { name: "战利品" });
    // 战利品走 ItemRow：显示名 + 数量后缀 + 中文类型
    expect(within(dialog).getByText("腐化兽骨 ×2")).toBeInTheDocument();
    expect(within(dialog).getByText("材料")).toBeInTheDocument();

    // 浮窗里才真正收取
    fireEvent.click(within(dialog).getByRole("button", { name: "收取全部（1）" }));

    // 收完：浮窗关掉、入口按钮也随之消失
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "战利品" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /收取战利品/ })).not.toBeInTheDocument();
  });

  it("结算 · 战败：只显示失败，且结束本间 = 离开副本（我方全灭、无战利品）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    prepareMockDefeat();
    renderCombat();

    expect(await screen.findByText("💀 战斗失败。")).toBeInTheDocument();
    // 战败没有战利品：收取按钮不出现，中间只剩那一行胜负
    expect(screen.queryByRole("button", { name: /收取战利品/ })).not.toBeInTheDocument();
    // 卡面同样读得出战果：我方每个人都挂「已战死」，敌方一个没死
    const party = await screen.findByRole("region", { name: "队伍" });
    await waitFor(() => expect(screen.getAllByText("已战死").length).toBeGreaterThan(0));
    const partyCards = [...party.querySelectorAll("article.combatant-card")];
    expect(partyCards.length).toBeGreaterThan(0);
    for (const card of partyCards) {
      expect(card).toHaveClass("combatant-card--dead");
    }
    expect(
      within(screen.getByRole("region", { name: "敌人" })).queryByText("已战死"),
    ).not.toBeInTheDocument();
    // 打输了没有「下一间」：结束本间就是直接离开副本回家园
    const finish = await screen.findByRole("button", { name: "结束本次战斗" });
    expect(finish).toHaveAttribute("title", expect.stringContaining("离开副本"));
  });

  it("结算：这是最后一间，结束本间 = 直接离开副本回家园（不再绕一次地图）", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    // 落点要看 `/state`（有没有下一间）：等按钮 title 变成「离开副本」（/state 已回来）再点
    const endButton = await screen.findByRole("button", { name: "结束本次战斗" });
    await waitFor(() =>
      expect(endButton).toHaveAttribute("title", expect.stringContaining("离开副本")),
    );
    fireEvent.click(endButton);

    // 本间之后没有房间了：服务端推进必然拒绝（"副本已全部通关"），所以直接走退出那条路。
    // 中间不再停一次地图——那一屏此刻没有任何可做的事。
    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "地图" })).not.toBeInTheDocument();
  });

  it("结算：未收的战利品只提示不阻止（「!」长在收取按钮上，后果在 title 里）", async () => {
    enterMockDungeon("副本.荒废地窟");
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
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "收取战利品（1）" }));
    const dialog = await screen.findByRole("dialog", { name: "战利品" });
    fireEvent.click(within(dialog).getByRole("button", { name: "收取全部（1）" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "结束本次战斗" })).not.toHaveClass(
        "icon-button--warn",
      ),
    );
  });
});
