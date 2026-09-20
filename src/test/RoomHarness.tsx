import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http } from "msw";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { api } from "../mocks/handlers";
import { sseResponse } from "../mocks/sseResponse";

/**
 * 副本房间测试的公共外壳：QueryClient + MemoryRouter + 「房间页 / 家园页」两条路由。
 *
 * 房间页从路由挂载——`DungeonRoomRoute` 取回 `/room` 后按服务端判别字段分发到
 * `OpeningRoomPage` / `CombatRoomPage`，所以三个测试文件都从这里进（另外两条路由供「离开副本
 * 后跳家园」的用例断言落点）。这里与 `?seed=` 的 mock 深链无关：那是 dev 入口的事。
 *
 * 放在 `src/test/`（测试基建），只被测试引用；`checkFileConventions` 已把该目录列入
 * `.tsx` 白名单（见 docs/conventions.md §一）。
 */
export default function RoomHarness({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/game/webdev/Game1/dungeon/room"]}>
        <Routes>
          <Route path="/game/:userName/:gameName/dungeon/room" element={children} />
          <Route path="/game/:userName/:gameName/home" element={<p>家园页占位</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** 把页面挂到路由上渲染：房间页需要一个已解析的 `room`，所以统一从路由进（见上）。 */
export function renderRoom(page: ReactElement) {
  return render(<RoomHarness>{page}</RoomHarness>);
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
