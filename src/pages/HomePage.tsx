import { useParams } from "react-router";
import { $api } from "../api/query";
import { collectActors } from "../features/home/collectActors";
import { useHomeAdvance } from "../features/home/useHomeAdvance";
import SessionMessageList from "../features/session/SessionMessageList";
import { useSessionMessages } from "../features/session/useSessionMessages";

/**
 * 家园页：每个 stage 一张卡片，卡片内列出该 stage 的 actor；顶部可推进一轮。
 *
 * 会话来自 URL（/game/:userName/:gameName/home），所以本页可被直接深链——
 * 不必每次从启动屏、玩家入口走一遍。
 * 数据源：GET /api/stages/v1/{user_name}/{game_name}/state
 */
export default function HomePage() {
  const { userName, gameName } = useParams();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫，
  // 顺带避免把 undefined 塞进请求路径。守卫在调用任何 hook 之前完成。
  if (!userName || !gameName) {
    return (
      <main className="page">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/home</p>
      </main>
    );
  }

  return <HomeView userName={userName} gameName={gameName} />;
}

function HomeView({ userName, gameName }: { userName: string; gameName: string }) {
  const state = $api.useQuery("get", "/api/stages/v1/{user_name}/{game_name}/state", {
    params: { path: { user_name: userName, game_name: gameName } },
  });

  const mapping = state.data?.mapping ?? {};
  const stages = Object.entries(mapping);
  // 后端要求显式传入"要推进的角色"；口径与 TUI 一致：全部场景的全部角色
  const actors = collectActors(mapping);
  const advance = useHomeAdvance(userName, gameName, actors);
  const session = useSessionMessages(userName, gameName);
  const hasActors = actors.length > 0;

  let buttonLabel = "推进一步";
  if (advance.isStarting) {
    buttonLabel = "提交中…";
  } else if (advance.isRunning) {
    buttonLabel = "推进中…";
  }

  return (
    <main className="page">
      <h1>家园</h1>
      <p className="muted mono">
        {userName} / {gameName}
      </p>

      <p>
        <button
          type="button"
          disabled={!hasActors || advance.isStarting || advance.isRunning}
          onClick={advance.start}
        >
          {buttonLabel}
        </button>
      </p>

      {state.isSuccess && hasActors ? (
        <p className="muted">对全部 {actors.length} 个角色推进一步（后台任务，需要等待）</p>
      ) : null}
      {state.isSuccess && !hasActors ? <p className="muted">当前没有可推进的角色</p> : null}

      {advance.isCompleted ? <p className="ok">推进完成，家园状态已刷新。</p> : null}
      {advance.error ? <p className="error">推进失败：{advance.error}</p> : null}

      <h2>叙事</h2>
      {session.isPending ? <p className="muted">加载中…</p> : null}
      {session.error ? <p className="error">无法获取会话消息：{String(session.error)}</p> : null}
      <SessionMessageList messages={session.messages} />

      <h2>场景</h2>
      {state.isPending ? <p className="muted">加载中…</p> : null}
      {state.isError ? <p className="error">无法获取家园状态：{String(state.error)}</p> : null}

      {state.isSuccess ? (
        <div className="cards">
          {stages.map(([stage, stageActors]) => (
            <article key={stage} className="card">
              <h2 className="mono">{stage}</h2>
              {stageActors.length === 0 ? (
                <p className="muted">无角色</p>
              ) : (
                <ul className="chips">
                  {stageActors.map((actorName) => (
                    <li key={actorName} className="chip mono">
                      {actorName}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </main>
  );
}
