import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { enterMockDungeon } from "../../mocks/dungeons";
import { api } from "../../mocks/handlers";
import { server } from "../../mocks/node";
import DungeonRunGate from "./DungeonRunGate";

/**
 * `DungeonRunGate` 是副本进行中两条路由（地图 / 房间）共用的入口门，只做「取 `/room` →
 * 加载中 / 404 出口」。用例集中在**判断顺序**上：先看有没有 data、再看状态。
 */
const ROOM_PATH = "/api/dungeons/v1/{user_name}/{game_name}/room";

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DungeonRunGate userName="webdev" gameName="Game1">
          {(room) => <p>房间：{room.stage.name}</p>}
        </DungeonRunGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("DungeonRunGate", () => {
  it("取到房间就把 room 交给调用方渲染", async () => {
    enterMockDungeon("副本.荒村义庄");
    renderGate();

    expect(await screen.findByText("房间：场景.义庄前院")).toBeInTheDocument();
  });

  it("没有进行中的房间（404）：原样显示原因，并给回家园的出口", async () => {
    renderGate();

    expect(await screen.findByText(/当前副本没有进行中的房间/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← 返回家园" })).toBeInTheDocument();
  });

  it("已经有 data 时后台重取失败：不把已经拿到的房间屏换成错误页", async () => {
    // 真实场景：退出副本时 /room 会在房间屏仍挂载时被判 404（副本已被拆），
    // 于是缓存里留下「旧房间 + error」；下次再进副本时不该先看到错误页。
    enterMockDungeon("副本.荒村义庄");
    const queryClient = renderGate();
    expect(await screen.findByText("房间：场景.义庄前院")).toBeInTheDocument();

    server.use(
      http.get(api(ROOM_PATH), () =>
        HttpResponse.json({ detail: "当前副本没有进行中的房间" }, { status: 404 }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ["get", ROOM_PATH] });

    expect(screen.getByText("房间：场景.义庄前院")).toBeInTheDocument();
    expect(screen.queryByText(/无法获取当前房间/)).not.toBeInTheDocument();
  });
});
