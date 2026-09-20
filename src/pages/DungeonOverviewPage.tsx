import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { describeApiError } from "../api/describeApiError";
import { displayName } from "../components/displayName";
import StorageCostumeDialog from "../features/costume/StorageCostumeDialog";
import { useCostumeAction } from "../features/costume/useCostumeAction";
import DungeonInfoDialog from "../features/dungeon/DungeonInfoDialog";
import DungeonPanel from "../features/dungeon/DungeonPanel";
import EnterDungeonDialog from "../features/dungeon/EnterDungeonDialog";
import { useDungeonList } from "../features/dungeon/useDungeonList";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useEnterDungeon } from "../features/dungeon/useEnterDungeon";
import { useGenerateDungeon } from "../features/dungeon/useGenerateDungeon";
import ActorInfoDialog from "../features/identity/ActorInfoDialog";
import { usePlayerActor } from "../features/identity/usePlayerActor";
import ItemManagerDialog from "../features/items/ItemManagerDialog";
import RosterPanel from "../features/roster/RosterPanel";

/**
 * 副本总览页：**宏观阅览副本 + 做准备 + 决定是否进入**，不承担副本内的流程。
 *
 * 所以这里只有三类事：生成副本、查阅副本的静态模型数据、出征前的准备
 * （队伍名单、整理行装）。「进入副本」是这一步的**终点**——发起成功即切到
 * `DungeonRoomRoute`（副本进行中那一屏），页面的职责到此为止。
 *
 * 内容：
 * - 「生成新副本」→ `POST /api/home/generate_dungeon/v1/`（异步 job，等任务完成再刷新列表）；
 * - 「可用副本」卡片 → `GET /api/home/dungeon-list/v1/`（磁盘上的静态模型数据）：
 *   点卡片主体打开 `DungeonInfoDialog` 查阅（对应 TUI 的 `/list-dungeons` + `/dungeon @名`），
 *   点「进入副本」打开 `EnterDungeonDialog` 做最终确认（队伍 + 背包 + 确认）；
 * - 队伍名单 → `PartyRosterComponent` 的 add / remove；**点角色名打开 `ActorInfoDialog`**，
 *   与家园页「点角色 chip 看信息」是同一套流程（连穿/脱时装的两级浮窗也一并接上）；
 * - 「道具管理」→ `ItemManagerDialog` 的**移动版**（`craftEnabled={false}`）：
 *   出征前只整理行装（背包 ↔ 储物箱），不合成——合成必须在家园做。
 *
 * 页面是组合层：玩家名、浮窗开关、「进入成功后跳哪」都由页面接线
 * （features 之间不互相依赖，`onSelectActor` / `onConfirm` 都是回调）。
 */
export default function DungeonOverviewPage() {
  const { userName, gameName } = useParams();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫
  if (!userName || !gameName) {
    return (
      <main className="page">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/dungeon</p>
      </main>
    );
  }

  return <DungeonOverview userName={userName} gameName={gameName} />;
}

function DungeonOverview({ userName, gameName }: { userName: string; gameName: string }) {
  const navigate = useNavigate();
  const playerActor = usePlayerActor(userName, gameName);
  const generate = useGenerateDungeon(userName, gameName);
  const enterDungeon = useEnterDungeon(userName, gameName);
  const costume = useCostumeAction(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const dungeons = useDungeonList();

  // 正在查阅的副本（原始名）；非空即打开副本信息浮窗
  const [infoDungeon, setInfoDungeon] = useState<string | null>(null);
  // 正在确认进入的副本（原始名）；非空即打开进入确认浮窗
  const [enterTarget, setEnterTarget] = useState<string | null>(null);
  // 正在查看的角色（原始名）；非空即打开角色信息浮窗
  const [infoActor, setInfoActor] = useState<string | null>(null);
  // 是否叠出「选择时装」的二级浮窗
  const [isCostumeOpen, setIsCostumeOpen] = useState(false);
  // 是否打开「道具管理」浮窗
  const [isItemsOpen, setIsItemsOpen] = useState(false);

  // 生成副本与其他家园动作共用同一条 pipeline，同一时间只允许一个在跑
  const isBusy = generate.isStarting || generate.isRunning;
  const costumeBusy = costume.isStarting || costume.isRunning;
  const dungeonRun = run.data ?? null;
  // 浮窗是纯展示组件，副本对象由页面给：从列表缓存里按名字取（后端没有「查单个副本」的接口）
  const infoDungeonData = dungeons.data?.find((item) => item.name === infoDungeon) ?? null;

  let generateLabel = "生成新副本";
  if (generate.isStarting) {
    generateLabel = "提交中…";
  } else if (generate.isRunning) {
    generateLabel = "生成中…";
  }

  return (
    <main className="page page--wide">
      <h1>副本</h1>

      <div className="toolbar">
        {/* 副本进行中时，第一优先是回到那一屏，而不是再发起新的进入 */}
        {dungeonRun?.active ? (
          <button
            type="button"
            onClick={() => navigate(`/game/${userName}/${gameName}/dungeon/room`)}
          >
            回到副本：{displayName(dungeonRun.dungeon.name)}
          </button>
        ) : null}
        <button type="button" disabled={isBusy} onClick={generate.start}>
          {generateLabel}
        </button>
        <button
          type="button"
          disabled={playerActor.isPending || !playerActor.data}
          onClick={() => setIsItemsOpen(true)}
        >
          道具管理
        </button>
        <button type="button" onClick={() => navigate(`/game/${userName}/${gameName}/home`)}>
          ← 返回家园
        </button>
      </div>

      {generate.error ? <p className="error">生成副本失败：{generate.error}</p> : null}
      {playerActor.isError ? (
        <p className="error">无法识别玩家角色：{String(playerActor.error)}</p>
      ) : null}
      {dungeonRun?.active ? (
        <p className="muted">
          副本进行中：{displayName(dungeonRun.dungeon.name)} · 退出副本后才能进入新的副本。
        </p>
      ) : null}

      <DungeonPanel
        onSelect={setInfoDungeon}
        onEnter={setEnterTarget}
        enterDisabled={dungeonRun?.active ?? false}
      />

      <RosterPanel
        userName={userName}
        gameName={gameName}
        playerActor={playerActor.data ?? null}
        onSelectActor={setInfoActor}
      />

      {infoDungeonData ? (
        <DungeonInfoDialog dungeon={infoDungeonData} onClose={() => setInfoDungeon(null)} />
      ) : null}

      {enterTarget && playerActor.data ? (
        <EnterDungeonDialog
          userName={userName}
          gameName={gameName}
          playerActor={playerActor.data}
          dungeonName={enterTarget}
          busy={enterDungeon.isPending}
          error={enterDungeon.isError ? describeApiError(enterDungeon.error) : null}
          onConfirm={() => {
            enterDungeon.mutate(enterTarget, {
              // 成功即离开本页：玩家的场景已经变成副本第一关，这里已经没有可做的事
              onSuccess: () => navigate(`/game/${userName}/${gameName}/dungeon/room`),
            });
          }}
          onClose={() => {
            enterDungeon.reset();
            setEnterTarget(null);
          }}
        />
      ) : null}

      {infoActor ? (
        <ActorInfoDialog
          userName={userName}
          gameName={gameName}
          actorName={infoActor}
          busy={isBusy}
          costumeBusy={costumeBusy}
          costumeError={costume.error}
          onWearCostume={() => setIsCostumeOpen(true)}
          onRemoveCostume={() => costume.remove(infoActor)}
          // 二级浮窗开着时本层不响应关闭，避免一次 ESC 关掉两层
          onClose={() => {
            if (!isCostumeOpen) {
              setInfoActor(null);
            }
          }}
        />
      ) : null}

      {isCostumeOpen && infoActor ? (
        <StorageCostumeDialog
          userName={userName}
          gameName={gameName}
          targetName={infoActor}
          busy={costumeBusy}
          onWear={(itemName) => {
            setIsCostumeOpen(false);
            costume.wear(itemName, infoActor);
          }}
          onClose={() => setIsCostumeOpen(false)}
        />
      ) : null}

      {isItemsOpen && playerActor.data ? (
        <ItemManagerDialog
          userName={userName}
          gameName={gameName}
          actorName={playerActor.data}
          busy={isBusy}
          // 副本页只有移动：出征前整理行装用不上工坊
          craftEnabled={false}
          onClose={() => setIsItemsOpen(false)}
        />
      ) : null}
    </main>
  );
}
