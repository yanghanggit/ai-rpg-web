import { useEffect, useRef, useState } from "react";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import { firstEntity } from "../../entities/ecs";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import { readStageInfo } from "../../stage/readStageInfo";
import StageInfoDialog from "../../stage/StageInfoDialog";
import { stageNarrativeBody } from "../../stage/stageNarrativeBody";
import { useStageEntity } from "../../stage/useStageEntity";
import ActorCard from "../ActorCard";
import { COMBAT_STATE } from "./combatPhase";
import { type Combatant, roleLabel } from "./readCombat";
import type { CombatActions } from "./useCombatActions";

/**
 * 战斗开始前的那一屏（`init` / `round_start` 共用）：左边 **3 敌 / 3 我**的卡阵（中间一条分隔线，
 * 一局最多 3v3），右边一条同高的场景栏（环境叙述 + 大「开始」）。卡面与开场房共用 `ActorCard`。
 *
 * 进房间自动初始化一次（不重试）；「开始」是唯一动作：点它开第一回合（init 未成则先补 init 再开）。
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
  const sceneBody = stageNarrativeBody(narrative, stage, "。。。。。。");

  return (
    <>
      {combatants.length === 0 ? (
        <p className="muted">{combatPending ? "加载参战者…" : "场景内暂无参战者。"}</p>
      ) : null}
      {error ? <p className="error">开始战斗失败：{error}</p> : null}

      <section className="combat-setup">
        {/* 左：上 3 敌 / 下 3 我（一局战斗最多 3v3），两排之间一条分隔线 */}
        <div className="combat-setup-field">
          <section className="cards cards--party" aria-label="敌人">
            {monsters.map((combatant) => (
              <ActorCard
                key={combatant.name}
                name={combatant.name}
                badge={roleLabel(combatant)}
                stats={combatant.stats}
                onOpenInfo={() => setInfoActor(combatant.name)}
              />
            ))}
          </section>

          <hr className="combat-setup-divider" />

          <section className="cards cards--party" aria-label="队伍">
            {party.map((combatant) => (
              <ActorCard
                key={combatant.name}
                name={combatant.name}
                badge={roleLabel(combatant)}
                stats={combatant.stats}
                onOpenInfo={() => setInfoActor(combatant.name)}
              />
            ))}
          </section>
        </div>

        {/* 右：与卡阵同高的一条——叙述在上（整块可点看全文、文字居中），「开始」压在底 */}
        <section className="combat-setup-scene" aria-label="场景描述">
          <button
            type="button"
            className="combat-setup-narrative"
            aria-label={`查看场景：${displayName(stageName)}`}
            title="点这里看完整的场景信息（全文在浮窗里）"
            onClick={() => setIsStageOpen(true)}
          >
            <span className="combat-setup-narrative-label">场景描述</span>
            {/* 叙述还没长出来就先占位六个点，不写「加载中」那种解释性的话 */}
            <span className="combat-setup-narrative-text">{sceneBody}</span>
          </button>

          <button
            type="button"
            className="combat-setup-start"
            disabled={actions.isBusy}
            onClick={handleStart}
          >
            {actions.isBusy ? "准备中…" : hasRound ? "开始新回合" : "开始!"}
          </button>
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
