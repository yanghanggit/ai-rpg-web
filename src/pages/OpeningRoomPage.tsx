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
 * 开场房间整页（`room.type === "opening"`）。
 *
 * 与 `CombatRoomPage` 共用 `RoomScaffold`（标题 / 地图 / 叙事 / 离开副本），
 * 这里只写**开场房间与别的房间不同的那两件事**：
 * - **本间的主行动不占标题行那个槽位**（不传 `RoomScaffold` 的 `roomAction`）：开场房这个槽位
 *   从前放的是「初始化中 / 重试 / 结束本间」，但它们全都已经在正文里有入口——初始化三态在场景卡上
 *   （进行中 / 失败点卡重试 / 就绪点卡看全文），「结束本间」是场景卡右边那张「回到地图」卡。
 *   同一件事只留一个入口，所以标题行只剩三个「副本入口」，不再多一颗 ↻ / →；
 * - 所以**本间的数据与动作由页面持有**：`useOpeningActions` 只允许一个实例（见该 hook 注释），
 *   队伍也一样取一次往下传（角色卡与「还有奖励没领」的提醒都要用）。自动初始化也在这里发起。
 *
 * 正文交给 `OpeningRoomPanel`（生成奖励 → 领卡）。本间结束后进的是**地图**而不是下一间：
 * 推进是地图上的动作（`rooms[current_room_index + 1]` 才是下一间）。
 *
 * 路由入口是 `DungeonRoomRoute`：它取回当前房间后按服务端判别字段 `room.type` 分发到这里。
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

  // 自动初始化只对「本房间」触发一次：ref 记住已触发过的房间标识——StrictMode 下 effect 跑两次、
  // 或轮询导致重渲染都不会重复发任务；失败后不自动重试，改由场景卡手动重试（失败时点整张卡）。
  const autoInitRoom = useRef<string | null>(null);
  const roomId = `${userName}\u0000${gameName}\u0000${room.stage.name}`;

  useEffect(() => {
    if (room.initialized || autoInitRoom.current === roomId) {
      return;
    }
    autoInitRoom.current = roomId;
    actions.init.start();
  }, [actions, room.initialized, roomId]);

  // 副本内一律 replace：没有"后退"，只有前进与放弃离开（见 DungeonMapPanel）
  const toMap = () => navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true });

  // 「结束本间」之后去哪儿（还有下一间 → 地图；最后一间 → 直接离开副本）：去向与措辞与战斗房
  // 共用一份（`readRoomFinish`），这里只接上本页的动作。开场房不会"打输"，所以 `defeated` 恒为假。
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
