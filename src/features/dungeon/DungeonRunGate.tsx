import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { describeApiError } from "../../api/describeApiError";
import type { Schemas } from "../../api/types";
import { useDungeonRoom } from "./useDungeonRoom";

/**
 * 副本运行中的**入口门**：把「取当前房间 → 加载中 / 没有进行中的房间」这段守卫收成一份，
 * 供副本进行中的两条路由共用（`DungeonMapPage` 地图、`DungeonRoomRoute` 房间）。
 *
 * 它只做守卫，**不决定屏幕**——拿到房间后用 `children(room)` 交给调用方渲染，
 * 所以两条路由各自保持"我是哪一屏"的完整决策权（对照 docs/pages.md「一个房间两种路径」）。
 *
 * 判断顺序是**先看有没有 data、再看状态**，这不是口味问题：
 * react-query 允许「有 data + 报错」共存（`isRefetchError: isError && hasData`），
 * 而这类状态真的会发生——退出副本时 `/room` 会在房间页仍挂载时被判 404（副本已被拆），
 * 于是缓存里留下「旧房间 + error」。如果再进来时先判 `isError`，就会把**错误页当成副本第一屏**
 * 显示（应该继续渲染手上这份房间）。所以：没有 data 才谈加载 / 出错，有 data 就先渲染。
 *
 * 没有进行中的房间时 `/room` 返回 404（已退出 / 已结束），错误原样显示，并给一个回家园的出口
 * ——副本已经结束时这一屏无事可做，唯一的去处就是家园。
 */
export default function DungeonRunGate({
  userName,
  gameName,
  children,
}: {
  userName: string;
  gameName: string;
  children: (room: Schemas["DungeonRoomResponse"]["room"]) => ReactNode;
}) {
  const navigate = useNavigate();
  const room = useDungeonRoom(userName, gameName);

  if (room.data === undefined) {
    if (room.isError) {
      return (
        <main className="page page--wide">
          <p className="error">无法获取当前房间：{describeApiError(room.error)}</p>
          <div className="toolbar">
            <button type="button" onClick={() => navigate(`/game/${userName}/${gameName}/home`)}>
              ← 返回家园
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="page page--wide">
        <p className="muted">加载中…</p>
      </main>
    );
  }

  return <>{children(room.data)}</>;
}
