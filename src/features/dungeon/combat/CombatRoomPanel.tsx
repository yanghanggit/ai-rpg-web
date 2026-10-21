import { useEffect, useRef } from "react";
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
 * 只有三块屏：进房那一屏（`init`，一场战斗只出现一次）、行动面板（`turn`）、结算（`post`）。
 * **回合之间自动开下一回合**（`round_start` 只是行动面板里一瞬的"准备中"）：这里替玩家发
 * `draw`，同一个回合只发一次；只有失败时才停在原地等重试。
 * 共享的参战者快照与 job 动作只在这一层持有，Panel 不重复取数。
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

  const roundCount = room.combat.rounds.length;
  const draw = actions.draw.start;
  // 自动开下一回合：键 = 战斗名 + 回合数，同一个回合只发一次（挡住 StrictMode 双跑与轮询重渲染；
  // 带上战斗名，换一场战斗后从 1 开始也照样触发）。失败不自动重试，留给面板上的「重试」。
  const autoDrew = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "round_start") {
      return;
    }
    const key = `${room.combat.name}:${roundCount}`;
    if (autoDrew.current === key) {
      return;
    }
    autoDrew.current = key;
    draw();
  }, [phase, roundCount, room.combat.name, draw]);

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
          combatants={scene.combatants}
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
