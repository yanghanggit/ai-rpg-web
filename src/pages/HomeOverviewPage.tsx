import { useState } from "react";
import { useParams } from "react-router";
import { $api } from "../api/query";
import Modal from "../components/Modal";
import { collectActors } from "../features/home/collectActors";
import { useHomeAdvance } from "../features/home/useHomeAdvance";
import { useLogout } from "../features/home/useLogout";
import NarrativeOverlay from "../features/session/NarrativeOverlay";
import { useSessionMessages } from "../features/session/useSessionMessages";
import { useUnreadCount } from "../features/session/useUnreadCount";

/**
 * 家园概览页：一屏看全局。
 *
 * 页面只有两块内容——**功能按钮**和**场景卡片**：
 *
 * - 顶部按钮：推进 / 叙事未读 / 返回上一级
 * - 下方卡片：每个 stage 一张，列出其中的 actor
 *
 * 叙事不在这里展开（历史事件在浮层里看），所以页面上只留一个带「已看 / 总共」数字的
 * 通知按钮：右边大于左边就说明有新事件没看。
 *
 * 会话来自 URL（/game/:userName/:gameName/home），本页可被直接深链。
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

  const [isNarrativeOpen, setIsNarrativeOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // 通知按钮上的两个数字：已看 / 总共。右大于左即"有新事件没看"
  const total = session.messages.length;
  const unread = useUnreadCount(total, session.hasLoaded, isNarrativeOpen);
  const seen = total - unread;

  // 人数直接写在按钮上，页面上就不再需要那句解释文案
  let buttonLabel = `推进一步 · ${actors.length} 个角色`;
  if (advance.isStarting) {
    buttonLabel = "提交中…";
  } else if (advance.isRunning) {
    buttonLabel = "推进中…";
  }

  return (
    <main className="page">
      <h1>家园概览</h1>
      <p className="muted mono">
        {userName} / {gameName}
      </p>

      <div className="toolbar">
        <button
          type="button"
          disabled={!hasActors || advance.isStarting || advance.isRunning}
          onClick={advance.start}
        >
          {buttonLabel}
        </button>

        <button
          type="button"
          className={unread > 0 ? "count-button count-button--unread" : "count-button"}
          title={unread > 0 ? `有 ${unread} 条新事件未查看` : "没有新事件"}
          aria-label={`查看叙事事件（已看 ${seen} 条，共 ${total} 条）`}
          onClick={() => setIsNarrativeOpen(true)}
        >
          叙事 {seen} / {total}
        </button>
        <button type="button" onClick={() => setIsLogoutOpen(true)}>
          ← 返回上一级
        </button>
      </div>

      {advance.error ? <p className="error">推进失败：{advance.error}</p> : null}

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

      {isLogoutOpen ? (
        <Modal title="确认登出" onClose={() => setIsLogoutOpen(false)}>
          <p>
            登出会结束当前对局（<span className="mono">{userName}</span> /{" "}
            <span className="mono">{gameName}</span>），房间随即销毁，无法恢复。
          </p>
          <div className="modal-actions">
            <button type="button" disabled={logout.isPending} onClick={() => logout.mutate()}>
              {logout.isPending ? "登出中…" : "确定登出"}
            </button>
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => setIsLogoutOpen(false)}
            >
              取消
            </button>
          </div>
          {logout.isError ? <p className="error">登出失败：{String(logout.error)}</p> : null}
        </Modal>
      ) : null}
    </main>
  );
}
