import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import StorageCostumeDialog from "../features/costume/StorageCostumeDialog";
import { useCostumeAction } from "../features/costume/useCostumeAction";
import DungeonInfoDialog from "../features/dungeon/DungeonInfoDialog";
import DungeonPanel from "../features/dungeon/DungeonPanel";
import RosterPanel from "../features/dungeon/RosterPanel";
import { useGenerateDungeon } from "../features/dungeon/useGenerateDungeon";
import ActorInfoDialog from "../features/identity/ActorInfoDialog";
import { usePlayerActor } from "../features/identity/usePlayerActor";

/**
 * 副本页：家园之外单独一屏，展开所有与副本相关的操作。
 *
 * 为什么是 page 而不是浮窗：副本操作是一组独立流程（队伍名单、生成 / 查阅 / 进入副本……），
 * 内容会越滚越长，浮窗装不下，也容易和家园状态混淆。所以从家园页工具栏的「副本」
 * 按钮切过来，页面上再给「← 返回家园」切回去。
 *
 * 当前实现：
 * - 「生成新副本」→ `POST /api/home/generate_dungeon/v1/`（异步 job，等任务完成再刷新列表）；
 * - 「可用副本」卡片 → `GET /api/home/dungeon-list/v1/`（磁盘上的静态模型数据），
 *   点卡片打开 `DungeonInfoDialog` 查阅，对应 TUI 的 `/list-dungeons` + `/dungeon @名`；
 * - 队伍名单 → `PartyRosterComponent` 的 add / remove；**点角色名打开 `ActorInfoDialog`**，
 *   与家园页「点角色 chip 看信息」是同一套流程（连穿/脱时装的两级浮窗也一并接上）。
 *
 * 页面是组合层：玩家名与「点角色」的回调都由页面接线（features 之间不互相依赖）。
 */
export default function DungeonPage() {
  const { userName, gameName } = useParams();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫
  if (!userName || !gameName) {
    return (
      <main className="page">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/dungeon</p>
      </main>
    );
  }

  return <Dungeon userName={userName} gameName={gameName} />;
}

function Dungeon({ userName, gameName }: { userName: string; gameName: string }) {
  const navigate = useNavigate();
  const playerActor = usePlayerActor(userName, gameName);
  const generate = useGenerateDungeon(userName, gameName);
  const costume = useCostumeAction(userName, gameName);

  // 正在查阅的副本（原始名）；非空即打开副本信息浮窗
  const [infoDungeon, setInfoDungeon] = useState<string | null>(null);
  // 正在查看的角色（原始名）；非空即打开角色信息浮窗
  const [infoActor, setInfoActor] = useState<string | null>(null);
  // 是否叠出「选择时装」的二级浮窗
  const [isCostumeOpen, setIsCostumeOpen] = useState(false);

  // 生成副本与其他家园动作共用同一条 pipeline，同一时间只允许一个在跑
  const isBusy = generate.isStarting || generate.isRunning;
  const costumeBusy = costume.isStarting || costume.isRunning;

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
        <button type="button" disabled={isBusy} onClick={generate.start}>
          {generateLabel}
        </button>
        <button type="button" onClick={() => navigate(`/game/${userName}/${gameName}/home`)}>
          ← 返回家园
        </button>
      </div>

      {generate.error ? <p className="error">生成副本失败：{generate.error}</p> : null}

      <DungeonPanel onSelect={setInfoDungeon} />

      <RosterPanel
        userName={userName}
        gameName={gameName}
        playerActor={playerActor.data ?? null}
        onSelectActor={setInfoActor}
      />

      {infoDungeon ? (
        <DungeonInfoDialog dungeonName={infoDungeon} onClose={() => setInfoDungeon(null)} />
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
    </main>
  );
}
