import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { displayName } from "../../components/displayName";
import NarrativeOverlay from "../session/NarrativeOverlay";
import { useNarrative } from "../session/useNarrative";
import DeckBrowserDialog from "./DeckBrowserDialog";
import DungeonInfoDialog from "./DungeonInfoDialog";
import RoomActionsDialog from "./RoomActionsDialog";
import { readDungeonInfo } from "./readDungeonInfo";
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
 * 负责这几件事：
 * - 标题 = **副本名 (当前/总数) 房间名**，如「荒村义庄 (1/2) 义庄前院」。副本名与进度来自
 *   `/state`（房间模型没有自己的名字，界面上的房间名就是 `room.stage.name`）；`/state` 还没回来
 *   时先只显示房间名，避免标题卡在「加载中」；
 * - 标题行右侧**一个**齿轮图标「副本操作」入口：原来的 副本信息 / 叙事 / 离开副本 三个按钮折进
 *   `RoomActionsDialog`（纵向列表）。**未读叙事信号上提到这个齿轮**（变绿 + 角标），否则会被菜单吃掉；
 * - 齿轮旁的**牌组**图标入口：`DeckBrowserDialog`（一级名单 → 二级卡面 → 三级卡牌详情）。看牌组是只读浏览，
 *   与「副本操作」并列而不折进菜单（两者都是入口，不是子动作）；
 * - 「离开副本」是**任务接口**，而「回家」发生在任务内部（队伍被传回家园场景、副本被拆掉），
 *   所以在回调里触发、等任务终态、然后 `replace` 跳家园页（副本此刻已不存在，返回键不该回到这一屏）。
 *
 * **入口层同一时刻只开一个浮窗**：用一个 `pane` state 表达「菜单 → 子浮窗」的**切换**而非叠加
 * （对照 docs/pages.md「同类切换不叠第三层」，否则 ESC 该关哪层有歧义）。唯一例外是「牌组」入口
 * 内部自己管的一级 → 二级（同一 feature 的钻取，关层与 ESC 守卫都在 `DeckBrowserDialog` 里）。
 *
 * 房间正文由 `children` 传入。**这一层要克制**：往上加的东西必须真的适用于每一种房间。
 */

/** 当前开着的浮窗；`null` 表示都关着。 */
type RoomPane = "actions" | "info" | "narrative" | "decks" | null;

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

  const [pane, setPane] = useState<RoomPane>(null);

  // 叙事浮层开着即视为已读；入口按钮的未读信号由同一个 hook 给出
  const narrative = useNarrative(userName, gameName, pane === "narrative");

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
  // 菜单里「副本信息」右侧的进度（与 DungeonInfoDialog 同一个格式来源）
  const infoProgress =
    dungeon === null ? undefined : (readDungeonInfo(dungeon).progress ?? undefined);

  const unread = narrative.unread;
  const entryAria = exit.isBusy
    ? "副本操作（退出中）"
    : unread > 0
      ? `副本操作（有 ${unread} 条新叙事未看）`
      : "副本操作";

  return (
    <main className="page page--wide">
      {/* 标题行：齿轮图标紧贴标题右侧，留出正文空间（与卡片右上角 .card-info-button 同一套做法） */}
      <div className="page-head">
        <h1>
          {dungeonName}
          {progress} {displayName(roomName)}
        </h1>
        <button
          type="button"
          className={unread > 0 ? "icon-button icon-button--unread" : "icon-button"}
          aria-haspopup="dialog"
          aria-label={entryAria}
          title="副本操作"
          disabled={exit.isBusy}
          onClick={() => setPane("actions")}
        >
          ⚙{unread > 0 ? <span className="icon-badge">{unread}</span> : null}
        </button>
        {/* 与齿轮平级的第二个入口：看本次副本各成员的牌组（一级是名单、二级是某个人的卡面） */}
        <button
          type="button"
          className="icon-button icon-button--deck"
          aria-haspopup="dialog"
          aria-label="牌组"
          title="牌组"
          onClick={() => setPane("decks")}
        >
          ♠
        </button>
        {/* 图标按钮显示不下文字，退出中的反馈放在它旁边 */}
        {exit.isBusy ? <span className="muted">退出中…</span> : null}
      </div>

      {exitBlocked && exitBlockedHint ? <p className="muted">{exitBlockedHint}</p> : null}
      {exit.error ? <p className="error">离开副本失败：{exit.error}</p> : null}

      {children}

      {pane === "actions" ? (
        <RoomActionsDialog
          canOpenInfo={run.data !== undefined}
          infoMeta={infoProgress}
          exitBlocked={exitBlocked}
          exitBlockedHint={exitBlockedHint}
          exitBusy={exit.isBusy}
          narrative={{ seen: narrative.seen, total: narrative.total, unread }}
          onOpenInfo={() => setPane("info")}
          onOpenNarrative={() => setPane("narrative")}
          onExit={() => {
            // 直接触发：后端会在任务里按房间/时机拦截，失败原因由上面的 error 行显示
            setPane(null);
            exit.start();
          }}
          onClose={() => setPane(null)}
        />
      ) : null}

      {pane === "info" && run.data ? (
        <DungeonInfoDialog dungeon={run.data.dungeon} onClose={() => setPane(null)} />
      ) : null}

      {pane === "narrative" ? (
        <NarrativeOverlay messages={narrative.messages} onClose={() => setPane(null)} />
      ) : null}

      {pane === "decks" ? (
        <DeckBrowserDialog userName={userName} gameName={gameName} onClose={() => setPane(null)} />
      ) : null}
    </main>
  );
}
