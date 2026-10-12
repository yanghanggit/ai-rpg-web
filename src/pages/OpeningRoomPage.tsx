import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { Schemas } from "../api/types";
import OpeningRoomPanel from "../features/dungeon/opening/OpeningRoomPanel";
import { useOpeningActions } from "../features/dungeon/opening/useOpeningActions";
import RoomScaffold from "../features/dungeon/RoomScaffold";
import { readRoomFinish } from "../features/dungeon/readRoomFinish";
import { useDungeonParty } from "../features/dungeon/useDungeonParty";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";

/**
 * 开场房间整页（`room.type === "opening"`）：共用 `RoomScaffold`，正文交给 `OpeningRoomPanel`。
 *
 * 本间的数据与动作由页面持有（`useOpeningActions` 只允许一个实例、队伍取一次往下传），自动初始化
 * 也在这里发起。标题行不占 `roomAction`——初始化三态与「结束本间」都已在正文。
 */
export default function OpeningRoomPage({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: Schemas["OpeningRoom"];
}) {
  const navigate = useNavigate();
  const exit = useExitDungeon(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const actions = useOpeningActions(userName, gameName);
  const party = useDungeonParty(userName, gameName);

  // 自动初始化只对本房间触发一次（ref 挡住 StrictMode 双跑与轮询重渲染）；失败不重试
  const autoInitRoom = useRef<string | null>(null);
  const roomId = `${userName}\u0000${gameName}\u0000${room.stage.name}`;

  useEffect(() => {
    if (room.initialized || autoInitRoom.current === roomId) {
      return;
    }
    autoInitRoom.current = roomId;
    actions.init.start();
  }, [actions, room.initialized, roomId]);

  // 副本内一律 replace：没有"后退"
  const toMap = () => navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true });

  // 结束本间后的去向与措辞与战斗房共用一份；开场房不会打输，`defeated` 恒为假
  const finishPlan = readRoomFinish(run.data, false);
  const finish = {
    ...finishPlan,
    onActivate: finishPlan.leavesRun ? () => exit.start() : toMap,
  };

  return (
    <RoomScaffold userName={userName} gameName={gameName} exit={exit} roomName={room.stage.name}>
      <OpeningRoomPanel
        userName={userName}
        gameName={gameName}
        room={room}
        party={party}
        actions={actions}
        finish={finish}
      />
    </RoomScaffold>
  );
}
