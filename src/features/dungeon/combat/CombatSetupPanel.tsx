import { useEffect, useRef, useState } from "react";
import type { Schemas } from "../../../api/types";
import { firstEntity } from "../../entities/ecs";
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
 * 战斗开始前的那一屏（`init` / `round_start` 共用）：上面敌人、中间场景卡 + 「开始」卡、下面队伍。
 * 卡面与开场房共用 `StageCard` / `ActorCard`。
 *
 * 进入房间自动初始化一次（不重试）；「开始」是唯一动作：点它开第一回合（init 未成则先补 init 再开）。
 * 卡片只留名字 + 身份 + 一行 `hp/attack/defense`；敌我双方整卡都可开角色信息浮窗。
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
  const stageEntity = firstEntity(stage.data?.entities ?? {});
  const narrative = stageEntity === undefined ? null : readStageInfo(stageEntity).narrative;

  // 正在看场景全文（非空即打开场景信息浮窗）
  const [isStageOpen, setIsStageOpen] = useState(false);
  // 正在看角色信息的成员（原始名）；非空即打开角色信息浮窗
  const [infoActor, setInfoActor] = useState<string | null>(null);

  const initStart = actions.init.start;
  const draw = actions.draw.start;

  // 自动初始化只对本战场触发一次（ref 挡住 StrictMode 双跑与轮询重渲染）；失败不重试
  const autoInitRoom = useRef<string | null>(null);
  useEffect(() => {
    if (combat.state === COMBAT_STATE.ONGOING || autoInitRoom.current === combat.name) {
      return;
    }
    autoInitRoom.current = combat.name;
    initStart();
  }, [combat.name, combat.state, initStart]);

  // 点过「开始」但 init 还没落地：init 成功后再补发 draw（记住意图，而不是让按钮连点两次）
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
              // 开局前也显示攻防（决定先打谁）
              showAttackDefense
              onOpenInfo={() => setInfoActor(combatant.name)}
            />
          ))}
        </section>

        <section className="stage-row" aria-label="场景描述">
          {/* 与开场房共用同一张场景卡 */}
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
              // 开局前也显示攻防（决定先打谁）
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
