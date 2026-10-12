import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { describeApiError } from "../../api/describeApiError";
import type { Schemas } from "../../api/types";
import { useDungeonRoom } from "./useDungeonRoom";

/**
 * 副本进行中的入口门：取当前房间 → 加载中 / 404 出口，供地图与房间两条路由共用。
 * 只做守卫、不决定屏幕：拿到房间后交给 `children(room)`。
 *
 * 判据先看 data 再看状态：react-query 允许「有 data + 报错」共存（退出副本时 `/room` 在房间页仍挂载
 * 时被判 404），先判 `isError` 会把错误页当成副本第一屏。
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
