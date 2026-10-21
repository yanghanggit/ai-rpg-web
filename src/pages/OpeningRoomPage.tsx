import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import OpeningRoomPanel, { type OpeningRoom } from "../features/dungeon/opening/OpeningRoomPanel";
import { useOpeningInit } from "../features/dungeon/opening/useOpeningInit";
import { useSpoilsActions } from "../features/dungeon/opening/useSpoilsActions";
import RoomScaffold from "../features/dungeon/RoomScaffold";
import { readRoomFinish } from "../features/dungeon/readRoomFinish";
import { useDungeonParty } from "../features/dungeon/useDungeonParty";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";
import { useRoomEnded } from "../features/dungeon/useRoomEnded";

/**
 * 开场房整页（`room.type === "opening"`）：共用 `RoomScaffold`，正文交给 `OpeningRoomPanel`。
 *
 * 本间的数据与动作由页面持有（初始化 / 奖励各一个实例、队伍取一次往下传）；进本间**自动初始化一次**
 * （管道幂等，失败不重试）。「结束开局准备」同时记下客户端账（`endedRooms`）。
 */
export default function OpeningRoomPage({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: OpeningRoom;
}) {
  const navigate = useNavigate();
  const exit = useExitDungeon(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const spoils = useSpoilsActions(userName, gameName);
  const openingInit = useOpeningInit(userName, gameName);
  const party = useDungeonParty(userName, gameName);
  const { markEnded } = useRoomEnded(userName, gameName, room.stage.name);

  // 自动初始化只对本房间触发一次（ref 挡住 StrictMode 双跑与轮询重渲染）；
  // 初始化管道内部按消息标记幂等，重进本间再跑一次也无害；失败不重试。
  const autoInitRoom = useRef<string | null>(null);
  const roomId = `${userName}\u0000${gameName}\u0000${room.stage.name}`;

  useEffect(() => {
    if (autoInitRoom.current === roomId) {
      return;
    }
    autoInitRoom.current = roomId;
    openingInit.start();
  }, [openingInit, roomId]);

  // 副本内一律 replace：没有"后退"
  const toMap = () => navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true });

  // 结束本间后的去向与措辞与战斗房共用一份；开场房不会打输，`defeated` 恒为假
  const finishPlan = readRoomFinish(run.data, false);
  const finish = {
    ...finishPlan,
    onActivate: () => {
      // 先记账再走：地图据此把本行标成「已完成」、把按钮搬到下一间
      markEnded();
      if (finishPlan.leavesRun) {
        exit.start();
      } else {
        toMap();
      }
    },
  };

  return (
    <RoomScaffold userName={userName} gameName={gameName} exit={exit}>
      <OpeningRoomPanel
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
