import { Navigate, useParams } from "react-router";
import type { Schemas } from "../api/types";
import DungeonRunGate from "../features/dungeon/DungeonRunGate";
import DungeonMapPanel from "../features/dungeon/map/DungeonMapPanel";
import RoomScaffold from "../features/dungeon/RoomScaffold";
import { readRoomGuards } from "../features/dungeon/readRoomGuards";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";

/**
 * 副本地图整页（副本进行中的**枢纽屏**，`/game/:user/:game/dungeon/map`）。
 *
 * 为什么它是一个独立路由而不是"房间页里的一个视图"：地图是玩家会来回走的目的地，而
 * "我在哪一屏"正是导航该负责的事（刷新停在哪、深链到哪都因此有了确定答案）。房间类型与战斗阶段
 * 才是**屏幕内的派生状态**，它们依旧不进 URL（见 docs/pages.md「房间类型不进 URL」）。
 *
 * 页面只做三件事，正文交给 `map/DungeonMapPanel`：
 * - 取回当前房间并处理「加载中 / 没有进行中的房间」（`DungeonRunGate`，与房间路由共用同一个门）；
 * - 套上副本共同框架 `RoomScaffold`（标题 = 副本名 (当前/总数) 房间名 + 三个图标入口）——
 *   地图上同样要看叙事 / 战斗信息 / 牌组，它们本来就是"副本状态"的一部分；
 * - 「离开副本」「能不能前进」都不预判：前者由服务端在接口/任务里拦（原因原样显示），后者由
 *   `readNextRoom` + `readRoomGuards` 决定「有没有可前往的那一行」。
 *
 * **地图 = 房间之间那一站**：进入副本后落到这里（还没进第 1 间），某个房间结束后回到这里
 * （准备进下一间）。队伍的位置只有在这里改变（「前进」），房间页在"位置"上是只读的——这条边界
 * 是刻意的，将来地图要长成"选路"（多个候选）时，接缝已经在这了。
 *
 * **战斗没结束时地图不该出现**：队伍就在那间房里，而且这一屏此刻唯一能做的"回房间"本来就是它
 * 该待的地方。正常流程走不到（房间的结束动作才把人送到地图），但 URL / 收藏 / 返回键到得了，
 * 所以在这一层**转发**回房间。
 *
 * 标题与入口也跟着变：这一屏不在某一间房里，所以标题只留副本名（不带 "(1/2) 房间名"），
 * 也不渲染「地图」（⚑）——地图自己就是房间清单，再开一个浮窗看同一份清单是多余的。
 */
export default function DungeonMapPage() {
  const { userName, gameName } = useParams();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫
  if (!userName || !gameName) {
    return (
      <main className="page page--wide">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/dungeon/map</p>
      </main>
    );
  }

  return (
    <DungeonRunGate userName={userName} gameName={gameName}>
      {(room) => <DungeonMap userName={userName} gameName={gameName} room={room} />}
    </DungeonRunGate>
  );
}

function DungeonMap({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: Schemas["DungeonRoomResponse"]["room"];
}) {
  const guards = readRoomGuards(room);
  const exit = useExitDungeon(userName, gameName);

  // 战斗还没结束就到了地图：队伍就在那间房里，送回房间（这一屏此刻没有一件只有它能做的事）
  if (!guards.done && room.type === "combat") {
    return <Navigate to={`/game/${userName}/${gameName}/dungeon/room`} replace />;
  }

  return (
    <RoomScaffold userName={userName} gameName={gameName} exit={exit} showMap={false}>
      <DungeonMapPanel userName={userName} gameName={gameName} room={room} />
    </RoomScaffold>
  );
}
