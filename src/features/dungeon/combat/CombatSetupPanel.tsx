import { useEffect, useRef } from "react";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import { readStageInfo } from "../../stage/readStageInfo";
import { useStageEntity } from "../../stage/useStageEntity";
import { COMBAT_STATE } from "./combatPhase";
import { type Combatant, roleLabel, statsText } from "./readCombat";
import type { CombatActions } from "./useCombatActions";

/**
 * 战斗**开始之前**的那一屏（`init` / `round_start` 两个 phase 共用）。
 *
 * 布局对齐「横 = 场景 / 竖 = 人」：上面一排**敌人**卡、中间**场景卡 + 开始卡**、下面一排**队伍**卡，
 * 卡面风格延续开场房间（`opening/OpeningRoomPanel` 的场景卡与角色卡）。
 *
 * **开始卡是本屏唯一的动作**：它把玩家"送进对局"——没初始化就先跑 `init`，`init` 成功（状态变
 * `ONGOING`）后接着跑 `draw`，一次点击就落到**第一回合**。`init` 与 `draw` 是后端两个独立 job，
 * 这里用 `startRequested` 把它们接起来（`init` 完成 → 查询失效 → 本组件以新 `combat.state` 重渲染
 * → effect 补发 `draw`）。开局后（已有回合）它改成「开始新回合」，同一个动作、继续下一轮。
 *
 * 卡片只留**必要信息**：名字 + 身份 + 一行 `HP / 攻 / 防`。能量 / 格挡 / 牌堆在开局前全是 0，
 * 先不显示（它们属于回合行动那一屏）。
 */
export default function CombatSetupPanel({
  userName,
  gameName,
  stageName,
  combat,
  combatants,
  combatPending,
  actions,
}: {
  userName: string;
  gameName: string;
  /** 战斗房间的场景原始名（`room.stage.name`）：场景卡的环境叙述从这里取。 */
  stageName: string;
  combat: Schemas["Combat"];
  combatants: Combatant[];
  combatPending: boolean;
  actions: CombatActions;
}) {
  const stage = useStageEntity(userName, gameName, stageName);
  const narrative =
    stage.data?.entities[0] === undefined ? null : readStageInfo(stage.data.entities[0]).narrative;

  // 点过一次「开始」但 init 还没落地：init 成功（state 变 ONGOING）后由下面的 effect 补发 draw。
  // 用 ref 记住"玩家想开局"这个意图，而不是让按钮连点两次。
  const startRequested = useRef(false);
  const draw = actions.draw.start;

  useEffect(() => {
    if (!startRequested.current || combat.state !== COMBAT_STATE.ONGOING) {
      return;
    }
    startRequested.current = false;
    draw();
  }, [combat.state, draw]);

  /** 开局（未初始化 → init；已初始化 → draw）。`init` 完成后 effect 会接上 `draw`。 */
  function handleStart() {
    if (actions.isBusy) {
      return;
    }
    if (combat.state === COMBAT_STATE.ONGOING) {
      draw();
      return;
    }
    startRequested.current = true;
    actions.init.start();
  }

  const monsters = combatants.filter((combatant) => combatant.faction === "monster");
  const party = combatants.filter((combatant) => combatant.faction !== "monster");
  const hasRound = combat.rounds.length > 0;
  const error = actions.init.error ?? actions.draw.error;
  const sceneBody = stage.isPending ? "加载中…" : (narrative ?? "（暂无环境描写）");

  return (
    <>
      {combatants.length === 0 ? (
        <p className="muted">{combatPending ? "加载参战者…" : "场景内暂无参战者。"}</p>
      ) : null}
      {error ? <p className="error">开始战斗失败：{error}</p> : null}

      <section className="combat-setup">
        <section className="cards cards--party" aria-label="敌人">
          {monsters.map((combatant) => (
            <SetupCard key={combatant.name} combatant={combatant} />
          ))}
        </section>

        <section className="stage-row" aria-label="场景描述">
          <div className="stage-card">
            <span className="stage-card-label">场景描述</span>
            <span className="stage-card-body">{sceneBody}</span>
          </div>
          <button
            type="button"
            className="stage-next stage-next--start"
            disabled={actions.isBusy}
            onClick={handleStart}
          >
            <span className="stage-next-caption">
              {actions.isBusy ? "开始中…" : hasRound ? "开始新回合" : "开始!"}
            </span>
          </button>
        </section>

        <section className="cards cards--party" aria-label="队伍">
          {party.map((combatant) => (
            <SetupCard key={combatant.name} combatant={combatant} />
          ))}
        </section>
      </section>
    </>
  );
}

/** 开局前的参战者卡：名字 + 身份 + 一行属性（与开场房间的角色卡同一套骨架，省掉开局前无意义的数据）。 */
function SetupCard({ combatant }: { combatant: Combatant }) {
  return (
    <article className="card actor-card">
      <div className="card-head">
        <span className="chip mono">{displayName(combatant.name)}</span>
        <span className="badge">{roleLabel(combatant)}</span>
      </div>
      <p className="muted actor-card-stats">{statsText(combatant)}</p>
    </article>
  );
}
