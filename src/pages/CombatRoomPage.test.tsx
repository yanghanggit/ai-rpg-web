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

/** 找到某张手牌所在的 <li>（出牌控件在卡面里）。 */
function cardTileOf(cardName: string): HTMLElement {
  const tile = screen.getByText(cardName).closest("li");
  if (!(tile instanceof HTMLElement)) {
    throw new Error(`找不到卡牌 ${cardName} 的卡片`);
  }
  return tile;
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
    // 参战者：队友不入队时只有玩家 + 两个怪物
    expect(await screen.findByText("纸人")).toBeInTheDocument();
    expect(screen.getByText("棺中殭尸")).toBeInTheDocument();
    expect(screen.getAllByText("怪物")).toHaveLength(2);

    // 开始 = 抓牌：直接落到玩家回合（第一回合有了；初始化是自动跑的）
    fireEvent.click(screen.getByRole("button", { name: "开始!" }));
    expect(await screen.findByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
  });

  it("开局准备：队伍卡的名字可点开角色信息（敌人卡不给入口）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    // 队伍卡名字是按钮；敌人卡名字是静态文本（不是可操作对象）
    const name = await screen.findByRole("button", { name: "无名" });
    expect(screen.queryByRole("button", { name: "纸人" })).not.toBeInTheDocument();

    fireEvent.click(name);
    const dialog = await screen.findByRole("dialog", { name: "角色信息" });
    await within(dialog).findByText("属性");
    // 副本进行中家园接口会被拒，所以隐藏时装区
    expect(within(dialog).queryByRole("heading", { name: "时装" })).not.toBeInTheDocument();
  });

  it("开局准备：场景卡可点开「场景信息」全文（与开场房同一交互）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    const scene = await screen.findByRole("region", { name: "场景描述" });
    fireEvent.click(within(scene).getByRole("button", { name: "场景描述：查看场景信息" }));

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
    const list = await screen.findByRole("dialog", { name: "队伍牌组" });
    // 队友没入队时名单里只有玩家（牌组是点开才拉的，所以要等）
    expect(await within(list).findByRole("button", { name: /无名/ })).toHaveTextContent("玩家");
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

    expect(await screen.findByRole("heading", { name: "手牌" })).toBeInTheDocument();
    expect(screen.getByText("剖棺")).toBeInTheDocument();
    expect(screen.getByText("屏息")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "过牌（结束回合）" })).toBeInTheDocument();
  });

  it("出牌：按默认目标打出，回合记录出现该次出牌", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    await screen.findByText("剖棺");
    fireEvent.click(within(cardTileOf("剖棺")).getByRole("button", { name: "出牌" }));

    expect(await screen.findByText(/使用『剖棺』对 怪物.纸人/)).toBeInTheDocument();
  });

  it("过牌推进到怪物；推进怪物回合结束后回到开始新回合", async () => {
    server.use(instantTasks());
    renderCombatRoom();
    fireEvent.click(await screen.findByRole("button", { name: "开始!" }));

    // 我方过牌 → 轮到第一个怪物
    fireEvent.click(await screen.findByRole("button", { name: "过牌（结束回合）" }));
    await screen.findByText(/当前由 纸人 行动/);

    // 第一只怪物 → 第二只怪物：等行动者真的换了再点，避免点到忙碌中的按钮
    fireEvent.click(screen.getByRole("button", { name: "推进怪物回合" }));
    await screen.findByText(/当前由 棺中殭尸 行动/);

    // 第二只怪物 → 全员行动完，回准备屏（已有回合 → 按钮改成「开始新回合」）
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
    // 两只怪物都已战死
    expect(screen.getAllByText("已战死")).toHaveLength(2);
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
