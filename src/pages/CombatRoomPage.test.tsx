import { fireEvent, screen, within } from "@testing-library/react";
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

  it("共同框架在战斗房间同样给出「牌组」入口（与齿轮平级）", async () => {
    server.use(instantTasks());
    renderCombatRoom();

    await screen.findByRole("heading", { name: "荒村义庄 (2/2) 停柩房" });
    fireEvent.click(screen.getByRole("button", { name: "牌组" }));

    const list = await screen.findByRole("dialog", { name: "队伍牌组" });
    // 队友没入队时名单里只有玩家（牌组是点开才拉的，所以要等）
    expect(await within(list).findByRole("button", { name: /无名/ })).toHaveTextContent("玩家");
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

  it("结算：最后一关点「进入下一关」显示后端原因", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderCombat();

    fireEvent.click(await screen.findByRole("button", { name: "进入下一关" }));
    expect(await screen.findByText(/进入下一关失败：副本已全部通关/)).toBeInTheDocument();
  });
});
