import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import NarrativeOverlay from "../session/NarrativeOverlay";
import { useNarrative } from "../session/useNarrative";
import CombatInfoDialog from "./combat/CombatInfoDialog";
import { COMBAT_RESULT_LABELS, COMBAT_STATE_LABELS } from "./combat/combatPhase";
import DeckBrowserDialog from "./DeckBrowserDialog";
import DungeonMapDialog from "./DungeonMapDialog";
import RoomActionsDialog from "./RoomActionsDialog";
import { useDungeonRun } from "./useDungeonRun";
import type { ExitDungeon } from "./useExitDungeon";

/**
 * 房间无关的框架：两个房间页 + 地图页复用，所以这里不出现房间类型判断。
 *
 * 提供右上角三个入口（⚙ 副本操作 / ⚑ 地图 / ♠ 牌组）、`roomAction` 占位、离开副本后回家园；
 * 同一时刻只开一个浮层（`pane`），正文由 `children` 传。页面没有可见标题（都在 ⚙ / ⚑ 里）。
 * 加东西要克制：必须真的适用于每一种房间。
 */

/** 当前开着的浮窗；`null` 表示都关着。 */
type RoomPane = "actions" | "map" | "narrative" | "decks" | "combat" | null;

/** 本间的主行动：右上角那颗状态相关的图标，由页面算好传进来，本层只画。 */
export interface RoomAction {
  /** 单色字形。 */
  icon: string;
  /** 无障碍名字（也是悬停说明的底）。 */
  label: string;
  /** 更长的悬停说明；不给就用 `label`。 */
  title?: string;
  /** `warn` = 下一步会失去什么；默认中性色。 */
  tone?: "plain" | "warn";
  /** 字形的字号 / 基线微调类（见 `index.css`）。 */
  iconClass: string;
  onActivate: () => void;
}

export default function RoomScaffold({
  userName,
  gameName,
  exit,
  showMap = true,
  roomAction = null,
  children,
}: {
  userName: string;
  gameName: string;
  /** 「离开副本」的状态与触发。 */
  exit: ExitDungeon;
  /** 是否渲染「地图」入口；地图页自己就是房间清单，所以关掉。 */
  showMap?: boolean;
  /** 本间主行动；不给就不渲染（地图页、开场房都没有）。 */
  roomAction?: RoomAction | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const run = useDungeonRun(userName, gameName);

  const [pane, setPane] = useState<RoomPane>(null);

  // 叙事浮层开着即视为已读
  const narrative = useNarrative(userName, gameName, pane === "narrative");

  const homePath = `/game/${userName}/${gameName}/home`;

  useEffect(() => {
    if (!exit.isExited) {
      return;
    }
    // 任务内部已把人送回家园，这里只换屏；replace：副本已不存在，返回键不该回到这屏
    navigate(homePath, { replace: true });
  }, [exit.isExited, homePath, navigate]);

  const dungeon = run.data?.dungeon ?? null;

  // ⚙「副本操作」里那行「战斗信息」：战斗房才有，且不区分 phase
  const currentRoom = dungeon === null ? undefined : dungeon.rooms[dungeon.current_room_index];
  const combat = currentRoom?.type === "combat" ? currentRoom.combat : null;
  const combatSummary =
    combat === null
      ? null
      : `${COMBAT_STATE_LABELS[combat.state] ?? combat.state} · 第 ${
          combat.rounds.length
        } 回合 · 结果 ${COMBAT_RESULT_LABELS[combat.result] ?? combat.result}`;

  const unread = narrative.unread;
  const entryAria = exit.isBusy
    ? "副本操作（退出中）"
    : unread > 0
      ? `副本操作（有 ${unread} 条新叙事未看）`
      : "副本操作";

  return (
    <main className="page page--wide page--room">
      {/* 顶栏：只有操作入口，钉在右上角；不再有标题（副本信息在 ⚙ / ⚑ 里）。
          这条只有一行按钮高，纵向整块让给下面的参战者 / 手牌主区域。 */}
      <div className="page-head">
        <div className="page-head-actions">
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
          {/* 第二个入口：地图（只读设定 / 房间 / 敌人）；`/state` 未到时禁用，地图页不渲染它 */}
          {!showMap ? null : (
            <button
              type="button"
              className="icon-button icon-button--info"
              aria-haspopup="dialog"
              aria-label="地图"
              title="地图"
              disabled={run.data === undefined}
              onClick={() => setPane("map")}
            >
              ⚑
            </button>
          )}
          {/* 第三个入口：牌组（一级名单 → 二级卡面 → 三级详情） */}
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
          {/* 本间主行动：与左边三个「看副本」的入口同类不同义，是「现在该做什么」 */}
          {roomAction === null ? null : (
            <button
              type="button"
              className={`icon-button icon-button--room ${roomAction.iconClass}${
                roomAction.tone === "warn" ? " icon-button--warn" : ""
              }`}
              aria-label={roomAction.label}
              title={roomAction.title ?? roomAction.label}
              onClick={roomAction.onActivate}
            >
              {roomAction.icon}
            </button>
          )}
          {/* 图标显示不下文字，退出中的反馈放在旁边 */}
          {exit.isBusy ? <span className="muted">退出中…</span> : null}
        </div>
      </div>

      {/* 被服务端拒的原因（失败可能发生在任务里，所以提示只能挂在页面上） */}
      {exit.error ? <p className="error">离开副本失败：{exit.error}</p> : null}

      {children}

      {pane === "actions" ? (
        <RoomActionsDialog
          exitBusy={exit.isBusy}
          combatSummary={combatSummary}
          narrative={{ seen: narrative.seen, total: narrative.total, unread }}
          onOpenNarrative={() => setPane("narrative")}
          onOpenCombat={() => setPane("combat")}
          onExit={() => {
            // 直接触发：能不能走由后端在任务里拦，失败原因由上面的 error 行显示
            setPane(null);
            exit.start();
          }}
          onClose={() => setPane(null)}
        />
      ) : null}

      {pane === "map" && run.data ? (
        <DungeonMapDialog dungeon={run.data.dungeon} onClose={() => setPane(null)} />
      ) : null}

      {pane === "combat" && currentRoom?.type === "combat" ? (
        <CombatInfoDialog
          userName={userName}
          gameName={gameName}
          room={currentRoom}
          onClose={() => setPane(null)}
        />
      ) : null}

      {pane === "narrative" ? (
        <NarrativeOverlay messages={narrative.messages} onClose={() => setPane(null)} />
      ) : null}

      {pane === "decks" ? (
        <DeckBrowserDialog
          userName={userName}
          gameName={gameName}
          room={currentRoom ?? null}
          onClose={() => setPane(null)}
        />
      ) : null}
    </main>
  );
}
