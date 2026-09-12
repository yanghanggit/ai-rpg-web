import { useState } from "react";
import { useParams } from "react-router";
import { $api } from "../api/query";
import { collectActors } from "../features/home/collectActors";
import { useHomeAdvance } from "../features/home/useHomeAdvance";
import { useLogout } from "../features/home/useLogout";
import NarrativeOverlay from "../features/session/NarrativeOverlay";
import SessionMessageList from "../features/session/SessionMessageList";
import { useSessionMessages } from "../features/session/useSessionMessages";

/** 本页只内联最近这些条；完整历史在「全部叙事」浮层里。 */
const INLINE_MESSAGE_LIMIT = 3;

/**
 * 家园概览页：一屏看全局——全部场景与其中的角色、最近几条叙事、推进按钮。
 *
 * 叫 Overview 是因为它展示的是**宏观**信息（所有 stage、所有 actor 的汇总视图），
 * 而不是某个具体场景的内部；单条消息的完整历史另有一页。
 *
 * 会话来自 URL（/game/:userName/:gameName/home），所以本页可被直接深链——
 * 不必每次从启动屏、玩家入口走一遍。
 * 数据源：GET /api/stages/v1/{user_name}/{game_name}/state
 */
export default function HomeOverviewPage() {
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

  return <HomeOverview userName={userName} gameName={gameName} />;
}

function HomeOverview({ userName, gameName }: { userName: string; gameName: string }) {
  const state = $api.useQuery("get", "/api/stages/v1/{user_name}/{game_name}/state", {
    params: { path: { user_name: userName, game_name: gameName } },
  });

  const mapping = state.data?.mapping ?? {};
  const stages = Object.entries(mapping);
  // 后端要求显式传入"要推进的角色"；口径与 TUI 一致：全部场景的全部角色
  const actors = collectActors(mapping);
  const advance = useHomeAdvance(userName, gameName, actors);
  const session = useSessionMessages(userName, gameName);
  const logout = useLogout(userName, gameName);
  const hasActors = actors.length > 0;

  // 登出会销毁房间，属于不可逆操作，所以先问一句再执行
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  // 「全部叙事」浮层
  const [isNarrativeOpen, setIsNarrativeOpen] = useState(false);

  // 内联只展示最近几条；总数即"服务器上已有的全部事件"
  const total = session.messages.length;
  const recent = session.messages.slice(-INLINE_MESSAGE_LIMIT);

  let buttonLabel = "推进一步";
  if (advance.isStarting) {
    buttonLabel = "提交中…";
  } else if (advance.isRunning) {
    buttonLabel = "推进中…";
  }

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>家园概览</h1>
          <p className="muted mono">
            {userName} / {gameName}
          </p>
        </div>

        <div className="head-actions">
          {isConfirmingLogout ? (
            <>
              <span className="muted">登出会结束当前对局，确定？</span>
              <button type="button" disabled={logout.isPending} onClick={() => logout.mutate()}>
                {logout.isPending ? "登出中…" : "确定登出"}
              </button>
              <button
                type="button"
                disabled={logout.isPending}
                onClick={() => setIsConfirmingLogout(false)}
              >
                取消
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setIsConfirmingLogout(true)}>
              ← 返回上一级
            </button>
          )}
        </div>
      </header>

      {logout.isError ? <p className="error">登出失败：{String(logout.error)}</p> : null}

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
        <p className="muted">对全部 {actors.length} 个角色推进一步（任务，需要等待）</p>
      ) : null}
      {state.isSuccess && !hasActors ? <p className="muted">当前没有可推进的角色</p> : null}

      {advance.isCompleted ? <p className="ok">推进完成，家园状态已刷新。</p> : null}
      {advance.error ? <p className="error">推进失败：{advance.error}</p> : null}

      <section aria-labelledby="narrative-heading">
        <div className="section-head">
          <h2 id="narrative-heading">叙事</h2>
          <button
            type="button"
            className="count-link"
            title={`查看全部 ${total} 条事件`}
            aria-label={`查看全部事件：当前显示最近 ${recent.length} 条，共 ${total} 条`}
            onClick={() => setIsNarrativeOpen(true)}
          >
            显示 {recent.length} / 共 {total} 条 →
          </button>
        </div>
        {session.isPending ? <p className="muted">加载中…</p> : null}
        {session.error ? <p className="error">无法获取会话消息：{String(session.error)}</p> : null}
        <SessionMessageList messages={recent} />
      </section>

      <section aria-labelledby="stages-heading">
        <div className="section-head">
          <h2 id="stages-heading">场景</h2>
        </div>
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
      </section>

      {isNarrativeOpen ? (
        <NarrativeOverlay messages={session.messages} onClose={() => setIsNarrativeOpen(false)} />
      ) : null}
    </main>
  );
}
