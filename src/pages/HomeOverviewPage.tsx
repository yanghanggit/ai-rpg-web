import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { $api } from "../api/query";
import { displayName } from "../components/displayName";
import Modal from "../components/Modal";
import BlueprintInfoDialog from "../features/blueprint/BlueprintInfoDialog";
import StorageCostumeDialog from "../features/costume/StorageCostumeDialog";
import { useCostumeAction } from "../features/costume/useCostumeAction";
import { useCreationOrder } from "../features/entities/useCreationOrder";
import { collectActors } from "../features/home/collectActors";
import EntityBrowserDialog from "../features/home/EntityBrowserDialog";
import { findStageOfActor } from "../features/home/findStageOfActor";
import { orderActorsByStage } from "../features/home/orderActorsByStage";
import { useHomeAdvance } from "../features/home/useHomeAdvance";
import { useLogout } from "../features/home/useLogout";
import { useSwitchStage } from "../features/home/useSwitchStage";
import ActorInfoDialog from "../features/identity/ActorInfoDialog";
import { usePlayerActor } from "../features/identity/usePlayerActor";
import ItemManagerDialog from "../features/items/ItemManagerDialog";
import NarrativeButton from "../features/session/NarrativeButton";
import StageInfoDialog from "../features/stage/StageInfoDialog";

/**
 * 家园概览页：顶部一排功能按钮 + 下面每个 stage 一张场景卡（卡内角色可点开角色信息，卡片按
 * `creation_order` 稳定排序）。「副本」切到独立一屏；叙事只在浮层里看。会话来自 URL，可深链。
 */
export default function HomeOverviewPage() {
  const { userName, gameName } = useParams();

  // 路由已保证参数存在；显式守卫，避免把 undefined 塞进请求路径
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
  const navigate = useNavigate();
  const state = $api.useQuery("get", "/api/stages/v1/{user_name}/{game_name}/state", {
    params: { path: { user_name: userName, game_name: gameName } },
  });

  const actorsByStage = state.data?.actors_by_stage ?? {};
  // 后端顺序随增删变化，再按 creation_order 钉死一遍，卡片位置不跳（判定仍用原始映射）
  const creationOrder = useCreationOrder(userName, gameName);
  const orderedActorsByStage = orderActorsByStage(actorsByStage, creationOrder);
  const stages = Object.entries(orderedActorsByStage);
  // 推进要显式传角色：口径为全部场景的全部角色
  const actors = collectActors(actorsByStage);
  const advance = useHomeAdvance(userName, gameName, actors);
  const switchStage = useSwitchStage(userName, gameName);
  const playerActor = usePlayerActor(userName, gameName);
  const currentStage = findStageOfActor(actorsByStage, playerActor.data ?? null);
  const logout = useLogout(userName, gameName);
  const costume = useCostumeAction(userName, gameName);
  const hasActors = actors.length > 0;
  // 家园动作共享同一条 pipeline，同一时间只允许一个在跑
  const isBusy =
    advance.isStarting || advance.isRunning || switchStage.isStarting || switchStage.isRunning;

  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [infoActor, setInfoActor] = useState<string | null>(null);
  const [infoStage, setInfoStage] = useState<string | null>(null);
  const [isCostumeOpen, setIsCostumeOpen] = useState(false);
  const [isBlueprintInfoOpen, setIsBlueprintInfoOpen] = useState(false);
  const [isEntityBrowserOpen, setIsEntityBrowserOpen] = useState(false);
  const [isItemsOpen, setIsItemsOpen] = useState(false);

  let buttonLabel = `推进一步 · ${actors.length} 个角色`;
  if (advance.isStarting) {
    buttonLabel = "提交中…";
  } else if (advance.isRunning) {
    buttonLabel = "推进中…";
  }

  return (
    <main className="page page--wide">
      <h1>家园概览</h1>

      <div className="toolbar">
        <button type="button" disabled={!hasActors || isBusy} onClick={advance.start}>
          {buttonLabel}
        </button>

        <button
          type="button"
          disabled={playerActor.isPending || !playerActor.data}
          onClick={() => {
            if (playerActor.data) {
              setInfoActor(playerActor.data);
            }
          }}
        >
          角色信息
        </button>

        <button type="button" onClick={() => setIsBlueprintInfoOpen(true)}>
          蓝图信息
        </button>

        <button
          type="button"
          disabled={stages.length === 0}
          onClick={() => setIsEntityBrowserOpen(true)}
        >
          实体浏览器
        </button>

        <button
          type="button"
          disabled={playerActor.isPending || !playerActor.data}
          onClick={() => setIsItemsOpen(true)}
        >
          道具管理
        </button>

        <button type="button" onClick={() => navigate(`/game/${userName}/${gameName}/dungeon`)}>
          副本
        </button>

        <NarrativeButton userName={userName} gameName={gameName} />
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
                    {isCurrent ? <span className="badge badge--current">当前所在</span> : null}
                    <button
                      type="button"
                      className="card-info-button"
                      aria-label={`查看场景详情：${displayName(stage)}`}
                      title="查看场景详情"
                      onClick={() => setInfoStage(stage)}
                    >
                      ⓘ
                    </button>
                  </div>
                  {stageActors.length === 0 ? (
                    <p className="muted">无角色</p>
                  ) : (
                    <ul className="chips">
                      {stageActors.map((actorName) => (
                        <li key={actorName}>
                          <button
                            type="button"
                            className="chip chip-button mono"
                            onClick={() => setInfoActor(actorName)}
                          >
                            {displayName(actorName)}
                          </button>
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

      {infoActor ? (
        <ActorInfoDialog
          userName={userName}
          gameName={gameName}
          actorName={infoActor}
          busy={isBusy}
          costumeBusy={costume.isStarting || costume.isRunning}
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
          busy={costume.isStarting || costume.isRunning}
          onWear={(itemName) => {
            setIsCostumeOpen(false);
            costume.wear(itemName, infoActor);
          }}
          onClose={() => setIsCostumeOpen(false)}
        />
      ) : null}

      {infoStage ? (
        <StageInfoDialog
          userName={userName}
          gameName={gameName}
          stageName={infoStage}
          actorNames={orderedActorsByStage[infoStage] ?? []}
          // 点场景里的角色：关场景浮窗、换角色浮窗
          onSelectActor={(actorName) => {
            setInfoStage(null);
            setInfoActor(actorName);
          }}
          onClose={() => setInfoStage(null)}
        />
      ) : null}

      {isEntityBrowserOpen ? (
        <EntityBrowserDialog
          actorsByStage={orderedActorsByStage}
          // 点名字：关浏览器，换对应的信息浮窗
          onSelectStage={(stage) => {
            setIsEntityBrowserOpen(false);
            setInfoStage(stage);
          }}
          onSelectActor={(actorName) => {
            setIsEntityBrowserOpen(false);
            setInfoActor(actorName);
          }}
          onClose={() => setIsEntityBrowserOpen(false)}
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
