import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import CombatPostPanel from "./CombatPostPanel";
import CombatSetupPanel from "./CombatSetupPanel";
import CombatTurnPanel from "./CombatTurnPanel";
import { deriveCombatPhase } from "./combatPhase";
import { useCombatActions } from "./useCombatActions";
import { useCombatScene } from "./useCombatScene";

/**
 * 战斗房间的房间主体：按 `combat.state` 派生 phase，渲染对应 Panel。
 *
 * 共享的参战者快照（`useCombatScene`）与 job 动作（`useCombatActions`）只在这一层持有，Panel 不重复
 * 取数；只有某阶段用的动作（如结算的 `useCollectLoot`）跟着那个 Panel 走。动作成功后失效刷新 →
 * `room` 重取 → phase 重新派生，自动切 Panel。结束动作不在这里，由页面挂在标题行。
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

      {phase === "turn" ? (
        <CombatTurnPanel
          userName={userName}
          gameName={gameName}
          combat={room.combat}
          combatants={scene.combatants}
          currentActor={currentActor}
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
        <CombatSetupPanel
          userName={userName}
          gameName={gameName}
          stageName={room.stage.name}
          combat={room.combat}
          combatants={scene.combatants}
          combatPending={scene.isPending}
          actions={actions}
        />
      )}
    </>
  );
}
