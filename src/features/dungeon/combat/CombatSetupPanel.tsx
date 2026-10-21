import { useEffect, useRef } from "react";
import type { Schemas } from "../../../api/types";
import CombatField from "./CombatField";
import { COMBAT_STATE } from "./combatPhase";
import type { Combatant } from "./readCombat";
import type { CombatActions } from "./useCombatActions";

/**
 * 进房那一屏（phase `init`，一场战斗只出现一次）：上排敌人、下排我方，中间一颗「开始」。
 *
 * 点「开始」开第一回合（init 未落地就先补 init 再开）；此后整场战斗都在 `CombatTurnPanel`，
 * 不再回到这里。场景描述不在这屏显示（战斗房的场景信息入口已随之下线）。
 */
export default function CombatSetupPanel({
  userName,
  gameName,
  combat,
  combatants,
  combatPending,
  actions,
}: {
  userName: string;
  gameName: string;
  combat: Schemas["Combat"];
  combatants: Combatant[];
  combatPending: boolean;
  actions: CombatActions;
}) {
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

  /** 开局：已初始化 → `draw`；还没（自动初始化失败）→ 先 `init`，成功后 effect 接上 `draw`。 */
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

  const error = actions.init.error ?? actions.draw.error;

  return (
    <>
      {combatants.length === 0 ? (
        <p className="muted">{combatPending ? "加载参战者…" : "场景内暂无参战者。"}</p>
      ) : null}
      {error ? <p className="error">开始战斗失败：{error}</p> : null}

      <CombatField userName={userName} gameName={gameName} label="对阵" combatants={combatants}>
        <button
          type="button"
          className="combat-start"
          disabled={actions.isBusy}
          onClick={handleStart}
        >
          {actions.isBusy ? "准备中…" : "开始!"}
        </button>
      </CombatField>
    </>
  );
}
