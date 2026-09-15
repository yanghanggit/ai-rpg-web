import { useNavigate, useParams } from "react-router";
import RosterPanel from "../features/dungeon/RosterPanel";
import { usePlayerActor } from "../features/identity/usePlayerActor";

/**
 * 副本页：家园之外单独一屏，展开所有与副本相关的操作。
 *
 * 为什么是 page 而不是浮窗：副本操作是一组独立流程（队伍名单、生成 / 进入副本……），
 * 内容会越滚越长，浮窗装不下，也容易和家园状态混淆。所以从家园页工具栏的「副本」
 * 按钮切过来，页面上再给「← 返回家园」切回去。
 *
 * 当前实现：队伍名单（`PartyRosterComponent` 的 add / remove）。
 * 玩家名由页面解析后传给 `RosterPanel`——页面是组合层，features 之间不互相依赖。
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

  return (
    <main className="page page--wide">
      <h1>副本</h1>

      <div className="toolbar">
        <button type="button" onClick={() => navigate(`/game/${userName}/${gameName}/home`)}>
          ← 返回家园
        </button>
      </div>

      <RosterPanel userName={userName} gameName={gameName} playerActor={playerActor.data ?? null} />
    </main>
  );
}
