import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { describeApiError } from "../api/describeApiError";
import type { Schemas } from "../api/types";
import { displayName } from "../components/displayName";
import DungeonInfoDialog from "../features/dungeon/DungeonInfoDialog";
import OpeningRoomPanel from "../features/dungeon/OpeningRoomPanel";
import { useDungeonRoom } from "../features/dungeon/useDungeonRoom";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";

/**
 * 副本进行中（房间页）：**房间类型的共同框架**。
 *
 * 「进入副本」成功后切到这里——玩家的场景已经变成副本第一关，总览页那一刻起已无事可做，
 * 而家园接口在副本进行中会被后端拒绝，所以玩家需要一个明确知道自己在副本里的落点。
 *
 * 这一层只做所有房间都**相同**的事：
 * - 拉当前房间（`GET /api/dungeons/v1/{user}/{game}/room`）与运行中的副本（`/state`）；
 * - 标题 = **房间名**（`room.stage.name`；房间模型没有自己的名字）；
 * - 顶部动作区：「副本信息」（展示副本**进度**）与「离开副本」；
 * - 房间专属内容交给 `DungeonRoomBody`（按判别字段 `room.type` 分发）。
 *
 * 刻意**不**提供「返回副本总览」：按游戏逻辑，离开副本就是回家园（`→ /game/.../home`），
 * 副本进行中也没有别的去处。
 *
 * 「离开副本」是**任务接口**，而「回家」发生在任务内部（队伍被传回家园场景、副本被拆掉），
 * 所以这里只等任务终态、然后跳家园页——这一屏没有别的收尾动作。
 */
export default function DungeonRoomPage() {
  const { userName, gameName } = useParams();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫
  if (!userName || !gameName) {
    return (
      <main className="page page--wide">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/dungeon/room</p>
      </main>
    );
  }

  return <DungeonRoom userName={userName} gameName={gameName} />;
}

function DungeonRoom({ userName, gameName }: { userName: string; gameName: string }) {
  const navigate = useNavigate();
  const room = useDungeonRoom(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const exit = useExitDungeon(userName, gameName);

  // 是否打开「副本信息」浮窗
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const homePath = `/game/${userName}/${gameName}/home`;

  useEffect(() => {
    if (!exit.isExited) {
      return;
    }
    // 退出任务的内部实现已经把人传回家园，这里只负责换屏。
    // 用 replace：副本此刻已经不存在，返回键不该回到一个没有房间的页面。
    navigate(homePath, { replace: true });
  }, [exit.isExited, homePath, navigate]);

  return (
    <main className="page page--wide">
      {room.isPending ? <p className="muted">加载中…</p> : null}

      {room.isError ? (
        <>
          {/* 没有进行中的房间时后端返回 404（副本已退出 / 已结束），错误原样显示，不替它兜底 */}
          <p className="error">无法获取当前房间：{describeApiError(room.error)}</p>
          <div className="toolbar">
            {/* 副本已经结束时这一屏无事可做，唯一的去处就是家园 */}
            <button type="button" onClick={() => navigate(homePath)}>
              ← 返回家园
            </button>
          </div>
        </>
      ) : null}

      {room.isSuccess ? (
        <>
          <h1>{displayName(room.data.stage.name)}</h1>

          <div className="toolbar">
            <button
              type="button"
              disabled={run.data === undefined}
              onClick={() => setIsInfoOpen(true)}
            >
              副本信息
            </button>
            <button type="button" disabled={exit.isBusy} onClick={exit.start}>
              {exit.isBusy ? "退出中…" : "离开副本"}
            </button>
          </div>

          {exit.error ? <p className="error">离开副本失败：{exit.error}</p> : null}

          <DungeonRoomBody room={room.data} userName={userName} gameName={gameName} />
        </>
      ) : null}

      {isInfoOpen && run.data ? (
        <DungeonInfoDialog dungeon={run.data.dungeon} onClose={() => setIsInfoOpen(false)} />
      ) : null}
    </main>
  );
}

/**
 * 房间专属内容：**共同的框架在 `DungeonRoom`，这里只放某一种房间独有的东西。**
 *
 * 分发开关是后端判别联合的判别字段 `room.type`——与 TUI 的 `dungeon_room_router.py` 同一个开关
 * （TUI 只按类型切屏，没有共同框架，所以这一层是 web 端多出来的）。
 */
function DungeonRoomBody({
  room,
  userName,
  gameName,
}: {
  room: Schemas["DungeonRoomResponse"]["room"];
  userName: string;
  gameName: string;
}) {
  switch (room.type) {
    case "opening":
      return <OpeningRoomPanel userName={userName} gameName={gameName} room={room} />;
    case "combat":
      return <p className="muted">战斗房间界面尚未实现。</p>;
  }
}
