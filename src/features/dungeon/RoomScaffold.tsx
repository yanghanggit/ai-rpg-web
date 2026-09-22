import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { displayName } from "../../components/displayName";
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
 * 副本房间的**房间无关框架**：所有房间都相同的那一圈。
 *
 * 由两个房间页 + 地图页复用。所以这里**不允许**出现 `room.type` 一类的房间专属判断。
 *
 * 负责这几件事：
 * - 标题 = **副本名 (当前/总数) 房间名**，如「荒村义庄 (1/2) 义庄前院」。副本名与进度来自
 *   `/state`（房间模型没有自己的名字，界面上的房间名就是 `room.stage.name`）；`/state` 还没回来
 *   时先只显示房间名，避免标题卡在「加载中」；
 * - 标题行右侧**三个平级图标入口**（都不折进菜单）：
 *   1. 齿轮「副本操作」→ `RoomActionsDialog`（叙事 / 离开副本；**当前是战斗房时还多一行「战斗信息」**
 *      → `CombatInfoDialog`）。**未读叙事信号上提到这个齿轮**（变绿 + 角标），否则会被菜单吃掉；
 *   2. 黑旗「地图」→ `DungeonMapDialog`（地图与当前进度：整体设定 / 房间 / 敌人）；
 *      它与「牌组」一样是**只读浏览**，所以与「副本操作」平级而不做它的子项；
 *   3. 黑桃「牌组」→ `DeckBrowserDialog`（一级双方名单 → 二级卡面 → 三级卡牌详情）。
 * - 「离开副本」是**任务接口**，而「回家」发生在任务内部（队伍被传回家园场景、副本被拆掉），
 *   所以在回调里触发、等任务终态、然后 `replace` 跳家园页（副本此刻已不存在，返回键不该回到这一屏）。
 *   **客户端不预判能不能走**（"本间还没结束"这类前置由服务端在接口/任务里拦），被拒的原因原样显示
 *   在页面上——所以这里既没有禁用状态，也没有解释性提示行。
 * - `roomAction`（本间的**主行动**，标题行最右那颗状态相关的图标）只在这里占个位：
 *   “本间现在该做什么”由页面算（每个房间不一样），本层不判断房间、也不认识路由。
 *
 * **入口层同一时刻只开一个浮窗**：用一个 `pane` state 表达「菜单 → 子浮窗」的**切换**而非叠加
 * （对照 docs/pages.md「同类切换不叠第三层」，否则 ESC 该关哪层有歧义）。唯一例外是「牌组」入口
 * 内部自己管的一级 → 二级（同一 feature 的钻取，关层与 ESC 守卫都在 `DeckBrowserDialog` 里）。
 *
 * 房间正文由 `children` 传入。**这一层要克制**：往上加的东西必须真的适用于每一种房间。
 */

/** 当前开着的浮窗；`null` 表示都关着。 */
type RoomPane = "actions" | "map" | "narrative" | "decks" | "combat" | null;

/**
 * 本间的**主行动**：标题行最右边那颗状态相关的图标（由页面算好传进来，本层只负责画）。
 *
 * 为什么是状态相关的字形而不是固定文案：这个槽位的含义随本间状态变（战斗还没打完时没有这件事 →
 * 槽位空着；打完了 → 「结束本间」），而图标按钮显示不下文字，所以动作名全靠 `label` / `title`。
 */
export interface RoomAction {
  /** 单色字形。 */
  icon: string;
  /** 无障碍名字（也是悬停说明的底）：图标按钮全靠它讲清"这是干什么的"。 */
  label: string;
  /** 更长的悬停说明（后果、原因）；不给就用 `label`。 */
  title?: string;
  /** `warn` = 下一步会失去什么；默认中性色。 */
  tone?: "plain" | "warn";
  /** 字形的字号 / 基线微调类（不同字形墨迹差很多，见 `index.css`）。 */
  iconClass: string;
  onActivate: () => void;
}

export default function RoomScaffold({
  userName,
  gameName,
  exit,
  roomName,
  showMap = true,
  roomAction = null,
  children,
}: {
  userName: string;
  gameName: string;
  /** 「离开副本」的状态与触发（页面持有唯一实例后传下来：房间的结束动作也可能用到它）。 */
  exit: ExitDungeon;
  /**
   * 当前房间的显示名（原始名，即 `room.stage.name`；本层只负责经 `displayName` 展示）。
   * **不给就是"不在某一间房里"**（地图页）：标题只留副本名，连进度也不显示。
   */
  roomName?: string;
  /** 是否渲染「地图」入口（⚑）。地图页自己就是房间清单，所以关掉。 */
  showMap?: boolean;
  /** 本间的主行动（标题行那颗状态相关的图标）；不给就不渲染（地图页、开场房都没有）。 */
  roomAction?: RoomAction | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const run = useDungeonRun(userName, gameName);

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
  // 进度与房间名是一体的：只有"在某一间房里"时才有「(1/2) 房间名」这半截标题
  const progress =
    roomName !== undefined &&
    dungeon !== null &&
    dungeon.current_room_index >= 0 &&
    dungeon.current_room_index < dungeon.rooms.length
      ? ` (${dungeon.current_room_index + 1}/${dungeon.rooms.length})`
      : "";
  const dungeonName = dungeon === null ? "" : displayName(dungeon.name);

  // ⚙「副本操作」里那一行「战斗信息」：当前房间是战斗房时才有。它**不区分战斗 phase**——只依赖
  // “有没有战斗数据”，所以初始化 / 回合开始 / 行动 / 结算哪一阶段都能从菜单里看全部回合。
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
      {/* 标题行：齿轮图标紧贴标题右侧，留出正文空间（与卡片右上角 .card-info-button 同一套做法） */}
      <div className="page-head">
        <h1>
          {dungeonName}
          {progress}
          {roomName === undefined ? null : ` ${displayName(roomName)}`}
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
        {/* 与齿轮平级的第二个入口：地图（整体设定 / 房间 / 敌人；就是「地图 / 当前状态」的只读版）。
            `/state` 没回来时没有内容可展，先禁用。地图页不渲染它（`showMap=false`）：那一屏本来就是
            房间清单，再开一个浮窗看同一份清单是多余的。 */}
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
        {/* 与齿轮平级的第三个入口：看本次副本各成员的牌组（一级是名单、二级是某个人的卡面） */}
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
        {/* 本间的主行动：放在三个「副本入口」右侧并拉开一点。左边三个是同一类（看副本），
            这颗是“现在该做什么”——由页面按本间状态算好（战斗房：打完了才有「结束本次战斗」，
            没打完就是 `null`，槽位空着）。 */}
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
        {/* 图标按钮显示不下文字，退出中的反馈放在它旁边 */}
        {exit.isBusy ? <span className="muted">退出中…</span> : null}
      </div>

      {/* 被服务端拒的原因（失败可能发生在任务里，所以提示只能挂在页面上，不能塞回菜单浮窗） */}
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
            // 直接触发：后端会在任务里按房间/时机拦截，失败原因由上面的 error 行显示
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
