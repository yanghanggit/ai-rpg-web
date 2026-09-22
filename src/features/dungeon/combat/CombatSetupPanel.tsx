import { useEffect, useRef, useState } from "react";
import type { Schemas } from "../../../api/types";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import { readStageInfo } from "../../stage/readStageInfo";
import StageInfoDialog from "../../stage/StageInfoDialog";
import { stageNarrativeBody } from "../../stage/stageNarrativeBody";
import { useStageEntity } from "../../stage/useStageEntity";
import ActorCard from "../ActorCard";
import StageCard from "../StageCard";
import { COMBAT_STATE } from "./combatPhase";
import { type Combatant, roleLabel } from "./readCombat";
import type { CombatActions } from "./useCombatActions";

/**
 * 战斗**开始之前**的那一屏（`init` / `round_start` 两个 phase 共用）。
 *
 * 布局对齐「横 = 场景 / 竖 = 人」：上面一排**敌人**卡、中间**场景卡 + 开始卡**、下面一排**队伍**卡。
 * 卡面与开场房间**共用同一对组件**（`dungeon/StageCard`、`dungeon/ActorCard`），所以横竖同尺寸、
 * 措辞同来源；场景卡与开场房一样可点开「场景信息」全文。
 *
 * **进入战斗房间自动初始化一次**（与开场房间同一套）：用 ref 记住已触发过的战斗，StrictMode 下
 * effect 跑两次、或轮询重渲染都不会重复发任务；失败不自动重试——「开始」那颗按钮就是重试入口。
 * 所以本屏会先短暂显示「准备中…」，初始化成功后变成「开始」。
 *
 * **开始卡是本屏唯一的动作**：初始化完成后点它开启**第一回合**（`draw`）。若 init 还没成功
 * （失败后重试那条路），点它会先补 `init`、成功后由 `startRequested` effect 接上 `draw`——总之
 * 一次点击落到第一回合；开局后（已有回合）它改成「开始新回合」，同一个动作、继续下一轮。
 *
 * 卡片只留**必要信息**：名字 + 身份 + 一行 `HP / 攻 / 防`——**攻 / 防 在这一屏是要给的**
 * （`showAttackDefense`）：还没开打，对方的硬属性直接影响"先打谁 / 要不要打"的决策；到了行动面板
 * 就只留 `HP`（那里每多一项就少一分可读性，要看攻防点卡开角色信息）。能量 / 格挡 / 牌堆在开局前
 * 全是 0，先不显示（它们属于回合行动那一屏）。**敌人卡与队伍卡一样整卡可点开角色信息浮窗**
 * （`ActorInfoDialog`，副本内不提供穿 / 脱时装）——怪物也是可查阅的实体（身份 / 属性；没有外观
 * 组件就显示占位）。
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

  // 正在看场景全文（非空即打开场景信息浮窗）
  const [isStageOpen, setIsStageOpen] = useState(false);
  // 正在看角色信息的成员（原始名）；非空即打开角色信息浮窗
  const [infoActor, setInfoActor] = useState<string | null>(null);

  const initStart = actions.init.start;
  const draw = actions.draw.start;

  // 自动初始化只对「本战场」触发一次：ref 记住已触发过的战斗，StrictMode 下 effect 跑两次、
  // 或轮询导致重渲染都不会重复发任务；失败后不自动重试，改由「开始」那颗按钮手动重试。
  const autoInitRoom = useRef<string | null>(null);
  useEffect(() => {
    if (combat.state === COMBAT_STATE.ONGOING || autoInitRoom.current === combat.name) {
      return;
    }
    autoInitRoom.current = combat.name;
    initStart();
  }, [combat.name, combat.state, initStart]);

  // 点过一次「开始」但 init 还没落地：init 成功（state 变 ONGOING）后由下面的 effect 补发 draw。
  // 用 ref 记住"玩家想开局"这个意图，而不是让按钮连点两次。
  const startRequested = useRef(false);
  useEffect(() => {
    if (!startRequested.current || combat.state !== COMBAT_STATE.ONGOING) {
      return;
    }
    startRequested.current = false;
    draw();
  }, [combat.state, draw]);

  /** 开局：已初始化 → `draw`；还没（失败重试）→ 先 `init`，成功后 effect 接上 `draw`。 */
  function handleStart() {
    if (actions.isBusy) {
      return;
    }
    if (combat.state === COMBAT_STATE.ONGOING) {
      draw();
      return;
    }
    startRequested.current = true;
    initStart();
  }

  const monsters = combatants.filter((combatant) => combatant.faction === "monster");
  const party = combatants.filter((combatant) => combatant.faction !== "monster");
  const hasRound = combat.rounds.length > 0;
  const error = actions.init.error ?? actions.draw.error;
  const sceneBody = stageNarrativeBody(narrative, stage);

  return (
    <>
      {combatants.length === 0 ? (
        <p className="muted">{combatPending ? "加载参战者…" : "场景内暂无参战者。"}</p>
      ) : null}
      {error ? <p className="error">开始战斗失败：{error}</p> : null}

      <section className="combat-setup">
        <section className="cards cards--party" aria-label="敌人">
          {monsters.map((combatant) => (
            <ActorCard
              key={combatant.name}
              name={combatant.name}
              badge={roleLabel(combatant)}
              stats={combatant.stats}
              // 还没开打：对方的攻 / 防直接影响"先打谁 / 要不要打"，所以这一屏连它一起给
              showAttackDefense
              onOpenInfo={() => setInfoActor(combatant.name)}
            />
          ))}
        </section>

        <section className="stage-row" aria-label="场景描述">
          {/* 与开场房共用同一张场景卡：就绪态点整张卡看全文（场景信息浮窗） */}
          <StageCard
            state="ready"
            name={stageName}
            body={sceneBody}
            onActivate={() => setIsStageOpen(true)}
          />
          <button
            type="button"
            className="stage-next stage-next--start"
            disabled={actions.isBusy}
            onClick={handleStart}
          >
            <span className="stage-next-caption">
              {actions.isBusy ? "准备中…" : hasRound ? "开始新回合" : "开始!"}
            </span>
          </button>
        </section>

        <section className="cards cards--party" aria-label="队伍">
          {party.map((combatant) => (
            <ActorCard
              key={combatant.name}
              name={combatant.name}
              badge={roleLabel(combatant)}
              stats={combatant.stats}
              // 还没开打：对方的攻 / 防直接影响"先打谁 / 要不要打"，所以这一屏连它一起给
              showAttackDefense
              onOpenInfo={() => setInfoActor(combatant.name)}
            />
          ))}
        </section>
      </section>

      {isStageOpen ? (
        <StageInfoDialog
          userName={userName}
          gameName={gameName}
          stageName={stageName}
          // 战斗房里的「场景内角色」就是这一场的参战者
          actorNames={combatants.map((combatant) => combatant.name)}
          // 同类切换不叠层：点场景里的角色 → 关场景浮窗、换角色浮窗（与开场房同一套）
          onSelectActor={(actorName) => {
            setIsStageOpen(false);
            setInfoActor(actorName);
          }}
          onClose={() => setIsStageOpen(false)}
        />
      ) : null}

      {infoActor === null ? null : (
        <ActorInfoDialog
          userName={userName}
          gameName={gameName}
          actorName={infoActor}
          // 副本进行中家园接口会被拒，角色信息里不提供穿 / 脱时装
          costumeEnabled={false}
          onClose={() => setInfoActor(null)}
        />
      )}
    </>
  );
}
