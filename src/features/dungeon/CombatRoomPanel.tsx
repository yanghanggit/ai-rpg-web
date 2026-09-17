import { describeApiError } from "../../api/describeApiError";
import type { Schemas } from "../../api/types";
import CombatInitPanel from "./CombatInitPanel";
import CombatPostPanel from "./CombatPostPanel";
import CombatRoundStartPanel from "./CombatRoundStartPanel";
import CombatTurnPanel from "./CombatTurnPanel";
import { deriveCombatPhase } from "./combatPhase";
import { useCollectLoot } from "./useCollectLoot";
import { useCombatActions } from "./useCombatActions";
import { useCombatScene } from "./useCombatScene";

/**
 * 战斗房间的房间主体（`room.type === "combat"`）。
 *
 * 这是 web 端相对 TUI 多出来的**一层**：TUI 每个阶段是一个独立 Screen、靠 `switch_screen` 换屏；
 * 这里只做**按 `combat.state` 派生 phase → 渲染对应 Panel**。数据（参战者快照）与动作（七个
 * 战斗接口）都由本层持有，Panel 只做展示——避免每个阶段各自取数、快照互不一致。
 *
 * 动作成功后失效刷新 → `room` 重取 → `deriveCombatPhase` 重新派生 → 自动切到下一个 Panel，
 * 不需要 TUI 的「锁输入 → 回车 → 切屏」。结算（`post`）暂留占位。
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
  const collect = useCollectLoot(userName, gameName);

  const phase = deriveCombatPhase(room.combat);
  const latest = room.combat.rounds.at(-1) ?? null;
  const currentActor = latest?.current_actor ?? null;

  return (
    <>
      {scene.isError ? (
        <p className="error">无法获取参战者：{describeApiError(scene.error)}</p>
      ) : null}

      {phase === "init" ? (
        <CombatInitPanel
          combat={room.combat}
          combatants={scene.combatants}
          combatPending={scene.isPending}
          onInit={actions.init.start}
          initBusy={actions.init.isBusy}
          initError={actions.init.error}
        />
      ) : phase === "round_start" ? (
        <CombatRoundStartPanel
          combat={room.combat}
          combatants={scene.combatants}
          currentActor={currentActor}
          combatPending={scene.isPending}
          onDraw={actions.draw.start}
          drawBusy={actions.draw.isBusy}
          drawError={actions.draw.error}
        />
      ) : phase === "turn" ? (
        <CombatTurnPanel
          combat={room.combat}
          combatants={scene.combatants}
          currentActor={currentActor}
          combatPending={scene.isPending}
          actions={actions}
        />
      ) : (
        <CombatPostPanel
          userName={userName}
          gameName={gameName}
          combat={room.combat}
          combatants={scene.combatants}
          combatPending={scene.isPending}
          loot={scene.loot}
          onCollect={() => collect.mutate()}
          collectBusy={collect.isPending}
          collectError={collect.isError ? describeApiError(collect.error) : null}
        />
      )}
    </>
  );
}
