import { useState } from "react";
import { useParams } from "react-router";
import { $api } from "../api/query";
import { displayName } from "../components/displayName";
import Modal from "../components/Modal";
import BlueprintInfoDialog from "../features/blueprint/BlueprintInfoDialog";
import { collectActors } from "../features/home/collectActors";
import { findStageOfActor } from "../features/home/findStageOfActor";
import { useHomeAdvance } from "../features/home/useHomeAdvance";
import { useLogout } from "../features/home/useLogout";
import { useSwitchStage } from "../features/home/useSwitchStage";
import PlayerInfoDialog from "../features/identity/PlayerInfoDialog";
import { usePlayerActor } from "../features/identity/usePlayerActor";
import ItemManagerDialog from "../features/items/ItemManagerDialog";
import NarrativeOverlay from "../features/session/NarrativeOverlay";
import { useSessionMessages } from "../features/session/useSessionMessages";
import { useUnreadCount } from "../features/session/useUnreadCount";

/**
 * 家园概览页：一屏看全局。
 *
 * 页面只有两块内容——**功能按钮**和**场景卡片**：
 *
 * - 顶部按钮：推进 / 角色信息 / 蓝图信息 / 道具管理 / 叙事未读 / 返回上一级
 * - 下方卡片：每个 stage 一张，列出其中的 actor，并带「切换到此场景」按钮；
 *   玩家当前所在卡片高亮标记，其切换按钮禁用
 *
 * 「角色信息」打开 `PlayerInfoDialog`，展示玩家实体上必要的组件信息；
 * 「蓝图信息」打开 `BlueprintInfoDialog`，只展示蓝图名字 / 战役设定 / 世界系统；
 * 「道具管理」打开 `ItemManagerDialog`，管理背包 / 储物箱道具、工坊合成与穿戴中时装。
 * 玩家身份（player_actor）用于判断「当前场景」：优先用 `useStartGame` 预填的缓存，
 * 缺失时回退查询 group 端点（见 `features/identity/usePlayerActor.ts`）。
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
  // 顺序固定：直接沿用后端返回的 mapping key 顺序，客户端不排序、不重排。
  // 卡片位置是玩家的「空间记忆」，切换场景时卡片不能跳；当前场景靠高亮 + 角标表达，
  // 而不是把它移到最前。要改顺序请改后端（客户端不自行决定）。
  const stages = Object.entries(mapping);
  // 后端要求显式传入"要推进的角色"；口径与 TUI 一致：全部场景的全部角色
  const actors = collectActors(mapping);
  const advance = useHomeAdvance(userName, gameName, actors);
  const switchStage = useSwitchStage(userName, gameName);
  // 玩家角色名用于判断「当前在哪个场景」；缓存未命中时回退查询 group 端点
  const playerActor = usePlayerActor(userName, gameName);
  const currentStage = findStageOfActor(mapping, playerActor.data ?? null);
  const session = useSessionMessages(userName, gameName);
  const logout = useLogout(userName, gameName);
  const hasActors = actors.length > 0;
  // 家园动作共享同一条 pipeline，同一时间只允许一个在跑
  const isBusy =
    advance.isStarting || advance.isRunning || switchStage.isStarting || switchStage.isRunning;

  const [isNarrativeOpen, setIsNarrativeOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isPlayerInfoOpen, setIsPlayerInfoOpen] = useState(false);
  const [isBlueprintInfoOpen, setIsBlueprintInfoOpen] = useState(false);
  const [isItemsOpen, setIsItemsOpen] = useState(false);

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

      <div className="toolbar">
        <button type="button" disabled={!hasActors || isBusy} onClick={advance.start}>
          {buttonLabel}
        </button>

        <button
          type="button"
          disabled={playerActor.isPending || !playerActor.data}
          onClick={() => setIsPlayerInfoOpen(true)}
        >
          角色信息
        </button>

        <button type="button" onClick={() => setIsBlueprintInfoOpen(true)}>
          蓝图信息
        </button>

        <button
          type="button"
          disabled={playerActor.isPending || !playerActor.data}
          onClick={() => setIsItemsOpen(true)}
        >
          道具管理
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
      {switchStage.error ? <p className="error">切换失败：{switchStage.error}</p> : null}
      {playerActor.isError ? (
        <p className="error">无法识别玩家角色：{String(playerActor.error)}</p>
      ) : null}

      <section aria-labelledby="stages-heading">
        <div className="section-head">
          <h2 id="stages-heading">场景</h2>
        </div>

        {state.isPending ? <p className="muted">加载中…</p> : null}
        {state.isError ? <p className="error">无法获取家园状态：{String(state.error)}</p> : null}

        {state.isSuccess ? (
          <div className="cards">
            {stages.map(([stage, stageActors]) => {
              const isCurrent = stage === currentStage;
              const isSwitching = switchStage.switchingStage === stage;
              // 当前场景、有动作在跑、玩家身份还没解析出来时不接受切换
              const switchDisabled = isCurrent || isBusy || playerActor.isPending;
              let switchLabel = "切换到此场景";
              if (isCurrent) {
                switchLabel = "当前所在";
              } else if (isSwitching) {
                switchLabel = "切换中…";
              }

              return (
                <article key={stage} className={isCurrent ? "card card--current" : "card"}>
                  <div className="card-head">
                    <h2 className="mono">{displayName(stage)}</h2>
                    {isCurrent ? <span className="badge card-current-badge">当前所在</span> : null}
                  </div>
                  {stageActors.length === 0 ? (
                    <p className="muted">无角色</p>
                  ) : (
                    <ul className="chips">
                      {stageActors.map((actorName) => (
                        <li key={actorName} className="chip mono">
                          {displayName(actorName)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="card-actions">
                    <button
                      type="button"
                      disabled={switchDisabled}
                      onClick={() => switchStage.start(stage)}
                    >
                      {switchLabel}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {isNarrativeOpen ? (
        <NarrativeOverlay messages={session.messages} onClose={() => setIsNarrativeOpen(false)} />
      ) : null}

      {isPlayerInfoOpen && playerActor.data ? (
        <PlayerInfoDialog
          userName={userName}
          gameName={gameName}
          actorName={playerActor.data}
          onClose={() => setIsPlayerInfoOpen(false)}
        />
      ) : null}

      {isBlueprintInfoOpen ? (
        <BlueprintInfoDialog gameName={gameName} onClose={() => setIsBlueprintInfoOpen(false)} />
      ) : null}

      {isItemsOpen && playerActor.data ? (
        <ItemManagerDialog
          userName={userName}
          gameName={gameName}
          actorName={playerActor.data}
          busy={isBusy}
          onClose={() => setIsItemsOpen(false)}
        />
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
