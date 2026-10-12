import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { describeApiError } from "../api/describeApiError";
import { displayName } from "../components/displayName";
import StorageCostumeDialog from "../features/costume/StorageCostumeDialog";
import { useCostumeAction } from "../features/costume/useCostumeAction";
import DungeonMapDialog from "../features/dungeon/DungeonMapDialog";
import DungeonPanel from "../features/dungeon/overview/DungeonPanel";
import EnterDungeonDialog from "../features/dungeon/overview/EnterDungeonDialog";
import { useDungeonList } from "../features/dungeon/overview/useDungeonList";
import { useEnterDungeon } from "../features/dungeon/overview/useEnterDungeon";
import { useGenerateDungeon } from "../features/dungeon/overview/useGenerateDungeon";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import ActorInfoDialog from "../features/identity/ActorInfoDialog";
import { usePlayerActor } from "../features/identity/usePlayerActor";
import ItemManagerDialog from "../features/items/ItemManagerDialog";
import RosterPanel from "../features/roster/RosterPanel";

/**
 * 副本总览页（备战）：生成副本、查阅静态模型、整理队伍与行装，决定是否进入。
 *
 * 「进入副本」是终点——成功即切到地图（房间之间那一站）。页面只做组合与接线（浮窗开关、进入成功后
 * 跳哪），features 之间不互相依赖。副本进行中时本页只剩一个回房间的兜底入口。
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

  // 正在查阅的副本（原始名）；非空即打开「地图」浮窗
  const [infoDungeon, setInfoDungeon] = useState<string | null>(null);
  const [enterTarget, setEnterTarget] = useState<string | null>(null);
  const [infoActor, setInfoActor] = useState<string | null>(null);
  const [isCostumeOpen, setIsCostumeOpen] = useState(false);
  const [isItemsOpen, setIsItemsOpen] = useState(false);

  // 生成副本与其他家园动作共用同一条 pipeline
  const isBusy = generate.isStarting || generate.isRunning;
  const costumeBusy = costume.isStarting || costume.isRunning;
  const dungeonRun = run.data ?? null;
  // 浮窗是纯展示组件，副本对象由页面从列表缓存里按名字取（后端没有「查单个副本」接口）
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
        {/* 副本进行中时总览页无事可做，这个入口只是异常落点的兜底（返回键 / 地址栏）；落点是队伍所在的那间房 */}
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
        <DungeonMapDialog dungeon={infoDungeonData} onClose={() => setInfoDungeon(null)} />
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
              // 成功即离开本页，落点地图；replace：副本内没有后退
              onSuccess: () =>
                navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true }),
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
