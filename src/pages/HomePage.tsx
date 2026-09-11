import { useParams } from "react-router";
import { $api } from "../api/query";

/**
 * 家园页：每个 stage 一张卡片，卡片内列出该 stage 的 actor。
 *
 * 会话来自 URL（/game/:userName/:gameName/home），所以本页可被直接深链——
 * 不必每次从启动屏、玩家入口走一遍。数据源：GET /api/stages/v1/{user_name}/{game_name}/state
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

  const stages = Object.entries(state.data?.mapping ?? {});

  return (
    <main className="page">
      <h1>家园</h1>
      <p className="muted mono">
        {userName} / {gameName}
      </p>

      {state.isPending ? <p className="muted">加载中…</p> : null}
      {state.isError ? <p className="error">无法获取家园状态：{String(state.error)}</p> : null}

      {state.isSuccess ? (
        <div className="cards">
          {stages.map(([stage, actors]) => (
            <article key={stage} className="card">
              <h2 className="mono">{stage}</h2>
              {actors.length === 0 ? (
                <p className="muted">无角色</p>
              ) : (
                <ul className="chips">
                  {actors.map((actorName) => (
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
