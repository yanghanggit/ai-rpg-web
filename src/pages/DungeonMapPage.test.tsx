import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
 * `DungeonMapPage`（副本地图）的测试。
 *
 * 这一屏是**房间之间那一站**，也就是**唯一能改变队伍位置的地方**，所以要考三件事：
 * - 地图只有三种状态：刚进入副本（目标＝第 1 间）、两间之间（目标＝下一间）、没有可前往的房间；
 * - **动作长在目标那一行**（不另开工具栏），带按钮的行就是"能去哪"——所以没结束时只有本间那一行
 *   有按钮，也不再有"本间尚未结束，请先打完"这类说明句；
 * - 战斗没结束时地图不该出现：整页会把人**转发**回房间。
 *
 * 标题与入口也跟着收：这一屏不在某一间房里，所以标题只有副本名（没有 "(1/2) 房间名"），
 * 也不渲染「副本信息」（⚑）——地图自己就是房间清单。
 */
const renderMapPage = () => renderMap(<DungeonMapPage />);

/** 地图上某一行房间的 `<li>`（行里的按钮与徐标都从这一行里找，避免与别处同名）。 */
function roomRow(stageName: string): HTMLElement {
  const item = screen.getByText(stageName).closest("li");
  if (item === null) {
    throw new Error(`找不到房间行：${stageName}`);
  }
  return item;
}

describe("副本地图 · 状态与前进", () => {
  it("刚进入副本：标题只留副本名、没有「副本信息」入口，只有本间那一行带「进入房间」", async () => {
    // 进入但不初始化：开场房间还没进过（刚进入副本）
    enterMockDungeon("副本.荒村义庄");
    renderMapPage();

    expect(await screen.findByRole("heading", { name: "地图" })).toBeInTheDocument();
    // 标题只留副本名：不带进度、不带房间名（这一屏不在某一间房里）。
    // 标题里的副本名来自 /state，所以要等它回来（地图与房间共用同一个 `/state` 查询）
    expect(await screen.findByRole("heading", { name: "荒村义庄" })).toBeInTheDocument();
    // 地图自己就是房间清单，所以不再给「副本信息」；「副本操作」「牌组」照旧
    expect(screen.getByRole("button", { name: "副本操作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "牌组" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "副本信息" })).not.toBeInTheDocument();

    expect(screen.getByText("第 1 / 2 间")).toBeInTheDocument();
    // 房间表就是「副本信息」浮窗那一份（同一个 readDungeonInfo），敌人也一并列出
    expect(screen.getByText("义庄前院")).toBeInTheDocument();
    expect(screen.getByText("停柩房")).toBeInTheDocument();
    expect(screen.getByText(/HP 9/)).toBeInTheDocument();

    // 动作长在目标那一行：还没进过本间 → 本间那一行带「进入房间」，别的行什么都不带
    const first = roomRow("义庄前院");
    const second = roomRow("停柩房");
    expect(first).toHaveTextContent("你在这里");
    expect(within(first).getByRole("button", { name: "进入房间" })).toBeEnabled();
    expect(within(second).queryByRole("button")).not.toBeInTheDocument();
    expect(second).not.toHaveTextContent("下一间");

    // 页面上没有解释性提示行（也不预判「离开副本」能不能点）
    expect(screen.queryByText(/才能结束本间或离开副本/)).not.toBeInTheDocument();
  });

  it("「进入房间」：进入本间（开场房间整页），并自动开始初始化", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    renderMapPage();

    fireEvent.click(await screen.findByRole("button", { name: "进入房间" }));

    // 落到房间页：正文是队伍块（只有房间页有）；自动初始化跑完 → 卡上的「生成奖励」可点
    expect(await screen.findByRole("region", { name: "队伍" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "生成奖励" })).toBeEnabled());
    expect(screen.getByRole("heading", { name: "荒村义庄 (1/2) 义庄前院" })).toBeInTheDocument();
  });

  it("两间之间：已结束那一行标「已完成」，按钮搬到下一间那一行，一步推进并进入下一间", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒村义庄");
    initMockOpening();
    renderMapPage();

    // 本间已结束 → 本行是「已完成」，动作整行搬到下一间（不再另开工具栏、也没有确认框）
    await screen.findByText("已完成");
    const first = roomRow("义庄前院");
    const second = roomRow("停柩房");
    expect(first).toHaveTextContent("已完成");
    expect(within(first).queryByRole("button")).not.toBeInTheDocument();
    // 按钮把"去哪一间"写在 title 里（推进不可逆，事后回不了本间）
    const go = within(second).getByRole("button", { name: "前往下一间" });
    expect(go).toHaveAttribute("title", "前往下一间：停柩房（推进后回不了本间）");

    fireEvent.click(go);

    // 一步到位：推进成功后直接落在**战斗房间**（`useAdvanceStage` 先等重取落地，所以这里
    // 第一屏拿到的就是新房间，不会闪一下缓存里的开场房间）。判据用房间页独有的正文。
    expect(await screen.findByRole("button", { name: "初始化战斗" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "地图" })).not.toBeInTheDocument();
  });

  it("推进失败：后端原因显示在地图上，地图原地不动", async () => {
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

    expect(await screen.findByText(/副本已全部通关/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "地图" })).toBeInTheDocument();
  });

  it("最后一间已结束：没有任何行可去，只留一句话指向「离开副本」", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    prepareMockPostCombat();
    renderMapPage();

    // 最后一间也结束了 → 两行都「已完成」，没有任何一行带动作
    await waitFor(() => expect(roomRow("停柩房")).toHaveTextContent("已完成"));
    expect(screen.queryByRole("button", { name: "前往下一间" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "进入房间" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/副本已全部通关：用「副本操作」里的「离开副本」回家园/),
    ).toBeInTheDocument();
  });

  it("战斗未结束就落到地图：被转发回房间（那里才是队伍待着的地方）", async () => {
    enterMockDungeon("副本.荒村义庄");
    advanceMockDungeon();
    renderMapPage();

    // 房间页的战斗初始化面板（地图上不会出现它）
    expect(await screen.findByRole("button", { name: "初始化战斗" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "地图" })).not.toBeInTheDocument();
  });
});
