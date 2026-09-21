import { useNavigate } from "react-router";
import type { Schemas } from "../api/types";
import CombatRoomPanel from "../features/dungeon/combat/CombatRoomPanel";
import { useCombatScene } from "../features/dungeon/combat/useCombatScene";
import RoomScaffold, { type RoomAction } from "../features/dungeon/RoomScaffold";
import { readRoomGuards } from "../features/dungeon/readRoomGuards";

/**
 * 战斗房间整页（`room.type === "combat"`）。
 *
 * 与 `OpeningRoomPage` 共用 `RoomScaffold`（标题 / 副本信息 / 叙事 / 离开副本），
 * 这里只接战斗房间的正文 `CombatRoomPanel`（按 `combat.state` 派生阶段 → 渲染对应面板，详见该
 * 组件注释），以及**本间的主行动**（标题行最右那颗图标）：战斗打完了才是「结束本次战斗」，
 * 否则这个槽位空着——还在打的时候没有"结束本间"这件事可做。
 *
 * `readRoomGuards` 的 `done` 就是判据（战斗房 = `state === POST_COMBAT`）；它与「离开副本」的
 * 前置禁用同源，但战斗房那条**不预判**（误退由后端拦），所以这里只接 `done`，不传 `exitBlocked`。
 *
 * 还没收的战利品与开场房的未领奖励同一套提醒（那颗 → 变提醒色 + 后果写进 title）——所以这里也要
 * 知道 `loot`：`useCombatScene` 是纯查询，和正文各持一个实例也只会共用同一份缓存。
 *
 * 路由入口是 `DungeonRoomRoute`：它取回当前房间后按服务端判别字段 `room.type` 分发到这里。
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
  const scene = useCombatScene(userName, gameName, room);

  // 还有战利品没收 → 「结束本间」也该是提醒色（没收的那些就留在身上拿不到了）
  const lootPending = scene.loot.length > 0;

  // 副本内一律 replace：没有"后退"，只有前进与放弃离开（见 DungeonMapPanel）
  const action: RoomAction | null = guards.done
    ? {
        icon: "→",
        label: "结束本次战斗",
        title: lootPending
          ? "结束本次战斗（回到地图）—— 还有战利品未收取，结束本间后就无法再收了。"
          : "结束本次战斗（回到地图）—— 本间结束后进不来。",
        tone: lootPending ? "warn" : "plain",
        iconClass: "icon-button--leave",
        onActivate: () => navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true }),
      }
    : null;

  return (
    <RoomScaffold
      userName={userName}
      gameName={gameName}
      roomName={room.stage.name}
      roomAction={action}
    >
      <CombatRoomPanel userName={userName} gameName={gameName} room={room} />
    </RoomScaffold>
  );
}
