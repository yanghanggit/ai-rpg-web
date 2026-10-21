import { fireEvent, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { advanceMockDungeon, enterMockDungeon } from "../mocks/dungeons";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { instantTasks, renderRoom } from "../test/RoomHarness";
import DungeonRoomRoute from "./DungeonRoomRoute";

/**
 * 路由入口 `DungeonRoomRoute` 只做两件事：取回当前房间（处理「加载中 / 没有进行中的房间」），
 * 再按服务端判别字段把整页交给 `OpeningRoomPage` / `CombatRoomPage`。
 *
 * 两个房间页自己的行为在各自测试文件里（`OpeningRoomPage.test.tsx` / `CombatRoomPage.test.tsx`）；
 * 这里只验证「解析到哪一页」与「解析失败时的出口」。
 */
describe("副本房间 · 路由解析器", () => {
  it("没有进行中的房间（后端 404）：原样显示原因，并给出回家园的出口", async () => {
    // 没有 enterMockDungeon：/room 返回 404
    renderRoom(<DungeonRoomRoute />);

    expect(await screen.findByText(/当前副本没有进行中的房间/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← 返回家园" }));

    expect(await screen.findByText("家园页占位")).toBeInTheDocument();
  });

  it("进行中的是开场房间 → 分发到 OpeningRoomPage", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    renderRoom(<DungeonRoomRoute />);

    // 开场房间正文（事件屏）在，说明分发到了开场页
    expect(await screen.findByRole("region", { name: "房间正文" })).toBeInTheDocument();
  });

  it("进行中的是战斗房间 → 分发到 CombatRoomPage", async () => {
    server.use(instantTasks());
    enterMockDungeon("副本.荒废地窟");
    advanceMockDungeon();
    renderRoom(<DungeonRoomRoute />);

    // 战斗房间正文（开局准备阶段）在，说明分发到了战斗页
    expect(await screen.findByRole("button", { name: "开始!" })).toBeInTheDocument();
  });

  it("不认识的房间类型：明确报错，不塞进开场房", async () => {
    // 服务端将来新增房间类型时走这一支（判别联合里还没有它，所以这里强行造一个）
    server.use(
      http.get(api("/api/dungeons/v1/:userName/:gameName/room"), () =>
        HttpResponse.json({ room: { type: "puzzle", stage: { name: "场景.谜题" } } }),
      ),
    );
    enterMockDungeon("副本.荒废地窟");
    renderRoom(<DungeonRoomRoute />);

    expect(await screen.findByText("还不支持的房间类型：puzzle")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "房间正文" })).not.toBeInTheDocument();
  });
});
