import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import CombatPostPanel from "./CombatPostPanel";
import CombatSetupPanel from "./CombatSetupPanel";
import CombatTurnPanel from "./CombatTurnPanel";
import { deriveCombatPhase } from "./combatPhase";
import { useCombatActions } from "./useCombatActions";
import { useCombatScene } from "./useCombatScene";

/**
 * 战斗房间的房间主体：按 `combat.rounds` / `state` 派生 phase，渲染对应 Panel。
 *
 * 只有三块屏：进房那一屏（`init`，一次）、行动面板（`turn`，以及它的子状态 `round_start`）、
 * 结算（`post`）。共享的参战者快照（`useCombatScene`）与 job 动作（`useCombatActions`）只在
 * 这一层持有，Panel 不重复取数；动作成功后失效刷新 → `room` 重取 → phase 重新派生。
 */
export default function CombatRoomPanel({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: Schemas["CombatRoom"];
}) {
  const scene = useCombatScene(userName, gameName, room);
  const actions = useCombatActions(userName, gameName);

  const phase = deriveCombatPhase(room.combat);
  const latest = room.combat.rounds.at(-1) ?? null;
  const currentActor = latest?.current_actor ?? null;

  return (
    <>
      {scene.isError ? (
        <p className="error">无法获取参战者：{describeApiError(scene.error)}</p>
      ) : null}

      {phase === "init" ? (
        <CombatSetupPanel
          userName={userName}
          gameName={gameName}
          combat={room.combat}
          combatants={scene.combatants}
          combatPending={scene.isPending}
          actions={actions}
        />
      ) : phase === "post" ? (
        <CombatPostPanel
          userName={userName}
          gameName={gameName}
          combat={room.combat}
          loot={scene.loot}
        />
      ) : (
        <CombatTurnPanel
          userName={userName}
          gameName={gameName}
          combat={room.combat}
          combatants={scene.combatants}
          currentActor={currentActor}
          roundStart={phase === "round_start"}
          combatPending={scene.isPending}
          actions={actions}
        />
      )}
    </>
  );
}
