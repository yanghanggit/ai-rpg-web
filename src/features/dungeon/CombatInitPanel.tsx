import { useEffect, useRef } from "react";
import type { Schemas } from "../../api/types";
import CombatRoster from "./CombatRoster";
import CombatStatus from "./CombatStatus";
import type { Combatant } from "./readCombat";

/**
 * 战斗初始化（`state = NONE / INITIALIZATION`，对应 TUI `CombatInitScreen`）。
 *
 * 进入战斗房间后**自动初始化一次**（与 `OpeningRoomPanel` 同一套）：用 ref 记住已触发过的
 * 房间（`combat.name`），StrictMode 下 effect 跑两次、或轮询重渲染都不会重复发任务；
 * 失败不自动重试，把「初始化战斗」按钮留给玩家手动重试。
 */
export default function CombatInitPanel({
  combat,
  combatants,
  combatPending,
  onInit,
  initBusy,
  initError,
}: {
  combat: Schemas["Combat"];
  combatants: Combatant[];
  combatPending: boolean;
  onInit: () => void;
  initBusy: boolean;
  initError: string | null;
}) {
  const autoInitRoom = useRef<string | null>(null);

  useEffect(() => {
    if (autoInitRoom.current === combat.name) {
      return;
    }
    autoInitRoom.current = combat.name;
    onInit();
  }, [combat.name, onInit]);

  return (
    <>
      <CombatStatus combat={combat} currentActor={null} />
      <p className="muted">
        战斗尚未初始化。进入战斗房间会自动初始化一次；若失败，可点下方按钮重试。
      </p>

      <div className="toolbar">
        <button type="button" disabled={initBusy} onClick={onInit}>
          {initBusy ? "初始化中…" : "初始化战斗"}
        </button>
      </div>
      {initError ? <p className="error">初始化战斗失败：{initError}</p> : null}

      <section>
        <div className="section-head">
          <h2>参战者</h2>
        </div>
        <CombatRoster combatants={combatants} currentActor={null} pending={combatPending} />
      </section>
    </>
  );
}
