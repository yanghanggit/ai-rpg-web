import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { displayName } from "../../components/displayName";
import NarrativeButton from "../session/NarrativeButton";
import DungeonInfoDialog from "./DungeonInfoDialog";
import { useDungeonRun } from "./useDungeonRun";
import { useExitDungeon } from "./useExitDungeon";

/**
 * 副本房间的**房间无关框架**：所有房间都相同的那一圈。
 *
 * 由两个房间页复用：`OpeningRoomPage`（开场）与 `CombatRoomPage`（战斗）。所以这里
 * **不允许**出现 `room.type` 一类的房间专属判断——唯一随房间变化的是「离开副本」是否前置禁用，
 * 由调用方用 `exitBlocked` / `exitBlockedHint` 显式传入（开场房间未初始化时禁用；战斗房间不预判，
 * 由后端拦）。
 *
 * 负责三件事：
 * - 标题 = **副本名 (当前/总数) 房间名**，如「荒村义庄 (1/2) 义庄前院」。副本名与进度来自
 *   `/state`（房间模型没有自己的名字，界面上的房间名就是 `room.stage.name`）；`/state` 还没回来
 *   时先只显示房间名，避免标题卡在「加载中」；
 * - 顶部动作区：「副本信息」（展示副本**进度**）、「叙事」（与家园页共用 `NarrativeButton`）、
 *   「离开副本」；
 * - 「离开副本」是**任务接口**，而「回家」发生在任务内部（队伍被传回家园场景、副本被拆掉），
 *   所以这里只等任务终态、然后 `replace` 跳家园页（副本此刻已不存在，返回键不该回到这一屏）。
 *
 * 房间正文由 `children` 传入。**这一层要克制**：往上加的东西必须真的适用于每一种房间。
 */
export default function RoomScaffold({
  userName,
  gameName,
  roomName,
  exitBlocked = false,
  exitBlockedHint,
  children,
}: {
  userName: string;
  gameName: string;
  /** 当前房间的显示名（原始名，即 `room.stage.name`；本层只负责经 `displayName` 展示）。 */
  roomName: string;
  /** 「离开副本」是否前置禁用（服务端会在任务里拒绝不合法时机，这里只拦确定要拦的）。 */
  exitBlocked?: boolean;
  /** 禁用「离开副本」时写给玩家的原因。 */
  exitBlockedHint?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
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

  const dungeon = run.data?.dungeon ?? null;
  const progress =
    dungeon !== null &&
    dungeon.current_room_index >= 0 &&
    dungeon.current_room_index < dungeon.rooms.length
      ? ` (${dungeon.current_room_index + 1}/${dungeon.rooms.length})`
      : "";
  const dungeonName = dungeon === null ? "" : displayName(dungeon.name);

  return (
    <main className="page page--wide">
      <h1>
        {dungeonName}
        {progress} {displayName(roomName)}
      </h1>

      <div className="toolbar">
        <button type="button" disabled={run.data === undefined} onClick={() => setIsInfoOpen(true)}>
          副本信息
        </button>
        <NarrativeButton userName={userName} gameName={gameName} />
        <button type="button" disabled={exit.isBusy || exitBlocked} onClick={exit.start}>
          {exit.isBusy ? "退出中…" : "离开副本"}
        </button>
      </div>

      {exitBlocked && exitBlockedHint ? <p className="muted">{exitBlockedHint}</p> : null}
      {exit.error ? <p className="error">离开副本失败：{exit.error}</p> : null}

      {children}

      {isInfoOpen && run.data ? (
        <DungeonInfoDialog dungeon={run.data.dungeon} onClose={() => setIsInfoOpen(false)} />
      ) : null}
    </main>
  );
}
