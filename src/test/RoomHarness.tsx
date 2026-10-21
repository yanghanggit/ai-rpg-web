import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http } from "msw";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { api } from "../mocks/handlers";
import { sseResponse } from "../mocks/sseResponse";
import DungeonMapPage from "../pages/DungeonMapPage";
import DungeonRoomRoute from "../pages/DungeonRoomRoute";

/**
 * 副本「进行中」测试的公共外壳：QueryClient + MemoryRouter + 地图 / 房间 / 家园三条路由。
 *
 * 三条路由都挂**真页面**，因为要考的就是屏幕切换本身（地图 ⇄ 房间，全部 `replace`）：
 * `entry` 决定被测元素挂在哪一条上，另一条挂真页面当落点；家园页仍是占位。
 */
export default function RoomHarness({
  children,
  entry = "room",
}: {
  children: ReactNode;
  entry?: "room" | "map";
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  // 被测的那条路由渲染 children，另一条渲染真页面（跳过去之后看到的是真东西）
  const page = (path: "room" | "map") => {
    if (entry === path) {
      return children;
    }
    return path === "room" ? <DungeonRoomRoute /> : <DungeonMapPage />;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/game/webdev/Game1/dungeon/${entry}`]}>
        <Routes>
          <Route path="/game/:userName/:gameName/dungeon/map" element={page("map")} />
          <Route path="/game/:userName/:gameName/dungeon/room" element={page("room")} />
          <Route path="/game/:userName/:gameName/home" element={<p>家园页占位</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** 把页面挂到 `/dungeon/room` 上渲染。 */
export function renderRoom(page: ReactElement) {
  return render(<RoomHarness>{page}</RoomHarness>);
}

/** 把页面挂到 `/dungeon/map` 上渲染（地图页测试用）。 */
export function renderMap(page: ReactElement) {
  return render(<RoomHarness entry="map">{page}</RoomHarness>);
}

/**
 * 让**任意** job_id 的等待立刻成功。
 *
 * 不能改成覆盖 POST 端点：mock 的状态变化发生在 handler 里（初始化、奖励、挑卡），
 * 覆盖掉就什么都没发生。所以只把「等任务」这一步压成瞬时，其余照旧。
 *
 * 进入开场房间会自动初始化，所以几乎每个开场用例都要它——否则要真等 2 秒。
 */
export const instantTasks = () =>
  http.get(api("/api/tasks/v1/watch/:jobId"), ({ params }) =>
    sseResponse([
      JSON.stringify({ job_id: Number(params.jobId), status: "succeeded", error: null }),
    ]),
  );
