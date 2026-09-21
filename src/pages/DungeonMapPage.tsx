import { useParams } from "react-router";
import type { Schemas } from "../api/types";
import DungeonRunGate from "../features/dungeon/DungeonRunGate";
import DungeonMapPanel from "../features/dungeon/map/DungeonMapPanel";
import RoomScaffold from "../features/dungeon/RoomScaffold";
import { readRoomGuards } from "../features/dungeon/readRoomGuards";

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
 *   地图上同样要看叙事 / 副本信息 / 牌组，它们本来就是"副本状态"的一部分；
 * - 把「离开副本」的前置禁用交给 `readRoomGuards`（与开场房间同一条判据：开场未初始化时禁用）。
 *
 * **地图就是副本的"运行点"**：进入副本后落到这里，房间结束后回到这里，将来"重开游戏直接定位到
 * 运行中的副本"也定位到这里。它是唯一能表达"整局副本"的屏幕，而且永远是合法落点（本间没结束就
 * 进入房间、结束了就前往下一间）；这也解释了它为什么只依赖副本内可用的接口，不碰任何家园接口。
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

  return (
    <RoomScaffold
      userName={userName}
      gameName={gameName}
      roomName={room.stage.name}
      exitBlocked={guards.exitBlocked}
      exitBlockedHint={guards.exitBlockedHint ?? undefined}
    >
      <DungeonMapPanel userName={userName} gameName={gameName} room={room} />
    </RoomScaffold>
  );
}
