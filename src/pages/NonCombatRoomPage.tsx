import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import NonCombatRoomPanel, {
  type NonCombatRoom,
} from "../features/dungeon/nonCombat/NonCombatRoomPanel";
import { useOpeningInit } from "../features/dungeon/nonCombat/useOpeningInit";
import { useSpoilsActions } from "../features/dungeon/nonCombat/useSpoilsActions";
import RoomScaffold from "../features/dungeon/RoomScaffold";
import { readRoomFinish } from "../features/dungeon/readRoomFinish";
import { useDungeonParty } from "../features/dungeon/useDungeonParty";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";

/**
 * 非战斗房间整页（`room.type !== "combat"`，当前即 `opening`）：共用 `RoomScaffold`，正文交给
 * `NonCombatRoomPanel`。**奖励入口在这一层之下，与具体房间类型无关**（服务端语义也是「非战斗房间」）。
 *
 * 本间的数据与动作由页面持有（奖励 / 开场初始化各一个实例、队伍取一次往下传）。**自动初始化只对
 * 开场房间发起**（管道幂等），其它非战斗房不跑。
 */
export default function NonCombatRoomPage({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: NonCombatRoom;
}) {
  const navigate = useNavigate();
  const exit = useExitDungeon(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const spoils = useSpoilsActions(userName, gameName);
  const openingInit = useOpeningInit(userName, gameName);
  const party = useDungeonParty(userName, gameName);

  const isOpening = room.type === "opening";

  // 自动初始化只对本房间触发一次（ref 挡住 StrictMode 双跑与轮询重渲染）；
  // 初始化管道内部按消息标记幂等，重进本间再跑一次也无害；失败不重试。
  const autoInitRoom = useRef<string | null>(null);
  const roomId = `${userName}\u0000${gameName}\u0000${room.stage.name}`;

  useEffect(() => {
    if (!isOpening || autoInitRoom.current === roomId) {
      return;
    }
    autoInitRoom.current = roomId;
    openingInit.start();
  }, [isOpening, openingInit, roomId]);

  // 副本内一律 replace：没有"后退"
  const toMap = () => navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true });

  // 结束本间后的去向与措辞与战斗房共用一份；非战斗房不会打输，`defeated` 恒为假
  const finishPlan = readRoomFinish(run.data, false);
  const finish = {
    ...finishPlan,
    onActivate: finishPlan.leavesRun ? () => exit.start() : toMap,
  };

  return (
    <RoomScaffold userName={userName} gameName={gameName} exit={exit}>
      <NonCombatRoomPanel
        userName={userName}
        gameName={gameName}
        room={room}
        openingInit={openingInit}
        spoils={spoils}
        busy={openingInit.isBusy || spoils.isBusy}
        party={party}
        finish={finish}
      />
    </RoomScaffold>
  );
}
