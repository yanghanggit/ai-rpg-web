import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import CombatInitPanel from "./CombatInitPanel";
import CombatPostPanel from "./CombatPostPanel";
import CombatRoundStartPanel from "./CombatRoundStartPanel";
import CombatTurnPanel from "./CombatTurnPanel";
import { deriveCombatPhase } from "./combatPhase";
import { useCombatActions } from "./useCombatActions";
import { useCombatScene } from "./useCombatScene";

/**
 * 战斗房间的房间主体（`room.type === "combat"`）。
 *
 * 这是 web 端相对 TUI 多出来的**一层**：TUI 每个阶段是一个独立 Screen、靠 `switch_screen` 换屏；
 * 这里只做**按 `combat.state` 派生 phase → 渲染对应 Panel**。共享的参战者快照与 7 个 job 动作
 * 由本层持有，Panel 不做重复取数——避免每个阶段各自取数、快照互不一致（阶段专属动作见下）。
 *
 * 动作成功后失效刷新 → `room` 重取 → `deriveCombatPhase` 重新派生 → 自动切到下一个 Panel，
 * 不需要 TUI 的「锁输入 → 回车 → 切屏」。
 *
 * **放东西的规则**（面板变复杂时照此扩展；**不要因此给 phase 加路由**——phase 是服务端派生状态，
 * 不是导航状态）：
 * - **共享的、必须唯一一份的**留在这里：参战者快照（`useCombatScene`：各阶段看同一份，避免快照
 *   互不一致）与 7 个 job 动作（`useCombatActions`：共用后端同一把玩家锁，`isBusy` 必须合起来看）。
 * - **只有某个阶段用的**跟着那个阶段走：结算的「收取战利品」（`useCollectLoot`）与「结束本次战斗」
 *   都在 `CombatPostPanel` 里，本层不再认识它们。
 * - 真到 props 读不动了，再考虑上 context 消钻井（最后手段，Panel 会不再纯 props）；若某阶段内部
 *   长出**用户主动导航的子视图**，路由化那个子视图，而不是 phase。
 *
 * `onFinishRoom`（本间的结束动作 → 回地图）由页面接线后**透传**给结算面板，因为只有结算阶段才有
 * 这个动作（其他阶段还在打，谈不上结束）；本层自己不认识路由。推进下一间不在房间里——那是地图上
 * 的动作（见 `map/DungeonMapPanel`）。
 */
export default function CombatRoomPanel({
  userName,
  gameName,
  room,
  onFinishRoom,
}: {
  userName: string;
  gameName: string;
  room: Schemas["CombatRoom"];
  /** 本间的结束动作：回地图（仅结算阶段会用到，本层只做透传）。 */
  onFinishRoom: () => void;
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
          onFinishRoom={onFinishRoom}
        />
      )}
    </>
  );
}
