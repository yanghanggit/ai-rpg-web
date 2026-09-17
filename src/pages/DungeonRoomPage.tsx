import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { describeApiError } from "../api/describeApiError";
import type { Schemas } from "../api/types";
import { displayName } from "../components/displayName";
import CombatRoomPanel from "../features/dungeon/CombatRoomPanel";
import DungeonInfoDialog from "../features/dungeon/DungeonInfoDialog";
import OpeningRoomPanel from "../features/dungeon/OpeningRoomPanel";
import { useDungeonRoom } from "../features/dungeon/useDungeonRoom";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";
import NarrativeButton from "../features/session/NarrativeButton";

/**
 * 副本进行中（房间页）：**房间类型的共同框架**。
 *
 * 「进入副本」成功后切到这里——玩家的场景已经变成副本第一关，总览页那一刻起已无事可做，
 * 而家园接口在副本进行中会被后端拒绝，所以玩家需要一个明确知道自己在副本里的落点。
 *
 * 这一层只做所有房间都**相同**的事：
 * - 拉当前房间（`GET /api/dungeons/v1/{user}/{game}/room`）与运行中的副本（`/state`）；
 * - 标题 = **副本名 (当前/总数) 房间名**，如「荒村义庄 (1/2) 义庄前院」。副本名与进度来自
 *   `/state`（房间模型没有自己的名字，界面上的房间名就是 `room.stage.name`）；
 *   `/state` 还没回来时先只显示房间名，避免标题卡在「加载中」。
 * - 顶部动作区：「副本信息」（展示副本**进度**）、「叙事」（与家园页共用 `NarrativeButton`）
 *   与「离开副本」；
 * - 房间专属内容交给 `DungeonRoomBody`（按判别字段 `room.type` 分发）。
 *
 * 「叙事」放在这一层而不是某个房间体内：会话消息是**全局**的（本局所有事件），
 * 战斗房间也会产生叙事，所以它不是开场房间独有的东西。
 *
 * 「离开副本」要**显式判 room.type**：服务端要求开场房间先完成初始化才能退出（否则 409），
 * 所以 `opening && !initialized` 时直接禁用；`combat` 仍沿用「不提前禁用、错误原样显示」
 * 的老口径（战斗未结束退出由后端拦）。
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
        <RoomContent
          room={room.data}
          dungeon={run.data?.dungeon ?? null}
          userName={userName}
          gameName={gameName}
          exitBusy={exit.isBusy}
          exitError={exit.error}
          onExit={exit.start}
          onOpenInfo={() => setIsInfoOpen(true)}
          canOpenInfo={run.data !== undefined}
        />
      ) : null}

      {isInfoOpen && run.data ? (
        <DungeonInfoDialog dungeon={run.data.dungeon} onClose={() => setIsInfoOpen(false)} />
      ) : null}
    </main>
  );
}

/**
 * 房间页正文：标题 = 「副本名 (当前/总数) 房间名」（副本未就绪时只留房间名）。
 *
 * 「离开副本」按 `room.type` 分支：开场房间未初始化时禁用（服务端 409），
 * 战斗房间不预判（战斗未结束退出由后端拦）。
 */
function RoomContent({
  room,
  dungeon,
  userName,
  gameName,
  exitBusy,
  exitError,
  onExit,
  onOpenInfo,
  canOpenInfo,
}: {
  room: Schemas["DungeonRoomResponse"]["room"];
  dungeon: Schemas["Dungeon"] | null;
  userName: string;
  gameName: string;
  exitBusy: boolean;
  exitError: string | null;
  onExit: () => void;
  onOpenInfo: () => void;
  canOpenInfo: boolean;
}) {
  const progress =
    dungeon !== null &&
    dungeon.current_room_index >= 0 &&
    dungeon.current_room_index < dungeon.rooms.length
      ? ` (${dungeon.current_room_index + 1}/${dungeon.rooms.length})`
      : "";
  const dungeonName = dungeon === null ? "" : displayName(dungeon.name);

  // 服务端要求：开场房间先初始化完才能退出。初始化进行中 / 失败时也还没 initialized，一并拦住。
  const isExitBlocked = room.type === "opening" && !room.initialized;

  return (
    <>
      <h1>
        {dungeonName}
        {progress} {displayName(room.stage.name)}
      </h1>

      <div className="toolbar">
        <button type="button" disabled={!canOpenInfo} onClick={onOpenInfo}>
          副本信息
        </button>
        <NarrativeButton userName={userName} gameName={gameName} />
        <button type="button" disabled={exitBusy || isExitBlocked} onClick={onExit}>
          {exitBusy ? "退出中…" : "离开副本"}
        </button>
      </div>

      {isExitBlocked ? <p className="muted">开场房间尚未初始化，无法离开副本。</p> : null}
      {exitError ? <p className="error">离开副本失败：{exitError}</p> : null}

      <DungeonRoomBody room={room} userName={userName} gameName={gameName} />
    </>
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
      return <CombatRoomPanel userName={userName} gameName={gameName} room={room} />;
  }
}
