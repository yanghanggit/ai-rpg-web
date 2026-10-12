import { useNavigate } from "react-router";
import type { Schemas } from "../api/types";
import CombatRoomPanel from "../features/dungeon/combat/CombatRoomPanel";
import { useCombatScene } from "../features/dungeon/combat/useCombatScene";
import RoomScaffold, { type RoomAction } from "../features/dungeon/RoomScaffold";
import { readRoomFinish } from "../features/dungeon/readRoomFinish";
import { readRoomGuards } from "../features/dungeon/readRoomGuards";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";

/**
 * 战斗房间整页（`room.type === "combat"`）：共用 `RoomScaffold`，正文交给 `CombatRoomPanel`。
 *
 * 本间主行动只在这层接线：`guards.done`（战斗房 = `state === POST_COMBAT`）才有「结束本次战斗」，
 * 否则槽位空着；没收的战利品让那颗图标变提醒色。去向与开场房共用 `readRoomFinish`。
 */
export default function CombatRoomPage({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: Schemas["CombatRoom"];
}) {
  const navigate = useNavigate();
  const guards = readRoomGuards(room);
  const exit = useExitDungeon(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const scene = useCombatScene(userName, gameName, room);

  // 还有战利品没收 → 「结束本间」变提醒色
  const lootPending = scene.loot.length > 0;

  // 去向与措辞与开场房共用一份
  const finish = readRoomFinish(run.data, guards.defeated);

  // 副本内一律 replace：没有"后退"
  const action: RoomAction | null = guards.done
    ? {
        icon: "→",
        label: "结束本次战斗",
        title: `结束本次战斗（${finish.caption}）—— ${
          lootPending ? "还有战利品未收取，结束本间后就无法再收了。" : finish.hint
        }`,
        tone: lootPending ? "warn" : "plain",
        iconClass: "icon-button--leave",
        onActivate: finish.leavesRun
          ? () => exit.start()
          : () => navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true }),
      }
    : null;

  return (
    <RoomScaffold
      userName={userName}
      gameName={gameName}
      exit={exit}
      roomName={room.stage.name}
      roomAction={action}
    >
      <CombatRoomPanel userName={userName} gameName={gameName} room={room} />
    </RoomScaffold>
  );
}
