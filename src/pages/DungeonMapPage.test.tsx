import { fireEvent, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { prepareMockPostCombat } from "../mocks/combat";
import { advanceMockDungeon, enterMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { initMockOpening } from "../mocks/opening";
import { instantTasks, renderMap } from "../test/RoomHarness";
import DungeonMapPage from "./DungeonMapPage";

/**
 * `DungeonMapPage`（副本地图）的测试：进行中副本的**枢纽屏**。
 *
 * 它是唯一出现前进动作的地方，所以这里考三件事：
 * - 地图是只读的：列全房间、标出队伍在哪一间、本间结束与否；
 * - 前进动作是两态的：本间没结束 → 「进入房间」；本间结束 → 「前往下一间」（确认框 + 推进）；
 * - 不可前进时的原因（未结束 / 已通关 / 打输）写清楚，按钮禁用。
 *
 * 房间内没有出口、已结束的房间进不去，这两条由**状态机本身**保证（地图不再给出那个动作），
 * 所以用例只断言"动作不出现"，不另写守卫。
 */
const renderMapPage = () => renderMap(<DungeonMapPage />);

describe("副本地图 · 状态与前进", () => {
  it("刚进入副本：列出全部房间、标出队伍在哪一间，前进动作是「进入房间」", async () => {
    // 进入但不初始化：开场房间还没结束
    enterMockDungeon("副本.荒村义庄");
    renderMapPage();

    expect(await screen.findByRole("heading", { name: "地图" })).toBeInTheDocument();
    // 前进动作要等 `/state`（房间表）回来才出现，所以从它开始等
    expect(await screen.findByRole("button", { name: "进入房间" })).toBeEnabled();

    expect(screen.getByText("第 1 / 2 间")).toBeInTheDocument();
    // 房间表就是「副本信息」浮窗那一份（同一个 readDungeonInfo），敌人也一并列出
    expect(screen.getByText("义庄前院")).toBeInTheDocument();
    expect(screen.getByText("停柩房")).toBeInTheDocument();
    expect(screen.getByText(/HP 9/)).toBeInTheDocument();
    // 队伍所在的那一间 + 下一间的预览
    expect(screen.getByText("你在这里")).toBeInTheDocument();
    expect(screen.getByText("下一间")).toBeInTheDocument();

    // 本间没结束 → 只能进本间，不给「前往下一间」
    expect(screen.queryByRole("button", { name: "前往下一间" })).not.toBeInTheDocument();
    expect(screen.getByText(/本间尚未结束/)).toBeInTheDocument();
    // 没结束时「离开副本」也被锁（服务端要求开场先初始化）
    expect(screen.getByText("开场房间尚未初始化，无法离开副本。")).toBeInTheDocument();
  });

  it("「进入房间」：进入本间（开场房间整页），并自动开始初始化", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderMapPage();

    fireEvent.click(await screen.findByRole("button", { name: "进入房间" }));

    // 落到房间页：正文是队伍（只有房间页有），初始化已自动跑完（「生成奖励」出现）
    expect(await screen.findByRole("heading", { name: "队伍" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "生成奖励" })).toBeInTheDocument();
    // 此时地图已经卸载，标题才是无歧义的判据（地图上的标题也长这样）
    expect(screen.getByRole("heading", { name: "荒村义庄 (1/2) 义庄前院" })).toBeInTheDocument();
  });

  it("本间结束：「前往下一间」→ 确认框 → 一步推进并进入下一间", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    initMockOpening();
    renderMapPage();

    // 本间结束 → 前进动作换成「前往下一间」，且不再能进本间
    expect(await screen.findByText("你在这里（已结束）")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "进入房间" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "前往下一间" }));

    const dialog = await screen.findByRole("dialog", { name: "进入下一关" });
    // 目标恒为唯一一间，确认框把它摊开（推进不可逆）
    expect(within(dialog).getByText("停柩房")).toBeInTheDocument();
    expect(within(dialog).getByText("战斗")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "进入下一关" }));

    // 一步到位：推进成功后直接落在**战斗房间**（`useAdvanceStage` 先等重取落地，所以这里
    // 第一屏拿到的就是新房间，不会闪一下缓存里的开场房间）。
    // 判据只能用**房间页独有**的东西：「抓牌」是战斗房间的正文——地图上的标题也会变成
    // 「(2/2) 停柩房」（地图跟的是同一个 current_room），拿标题当判据会假阳性。
    expect(await screen.findByRole("button", { name: /抓牌/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "地图" })).not.toBeInTheDocument();
  });

  it("推进失败：后端原因显示在确认框里，地图原地不动", async () => {
    server.use(
      instantTasks(),
      http.post(api("/api/dungeon/progress/advance_stage/v1/"), () =>
        HttpResponse.json({ detail: "副本已全部通关，请返回营地" }, { status: 409 }),
      ),
    );
    enterMockDungeon("副本.荒村义庄");
    initMockOpening();
    renderMapPage();

    fireEvent.click(await screen.findByRole("button", { name: "前往下一间" }));
    const dialog = await screen.findByRole("dialog", { name: "进入下一关" });
    fireEvent.click(within(dialog).getByRole("button", { name: "进入下一关" }));

    expect(await within(dialog).findByText(/副本已全部通关/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "地图" })).toBeInTheDocument();
  });

  it("最后一间结束：没有下一间，只能离开副本", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderMapPage();

    expect(await screen.findByText("你在这里（已结束）")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "前往下一间" })).toBeDisabled();
    expect(screen.getByText(/副本已全部通关/)).toBeInTheDocument();
  });

  it("深链到地图且战斗未结束：仍然只能「进入房间」（地图不是逃出房间的出口）", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    renderMapPage();

    expect(await screen.findByText("你在这里")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "进入房间" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "前往下一间" })).not.toBeInTheDocument();
    expect(screen.getByText(/本间尚未结束/)).toBeInTheDocument();
  });
});
