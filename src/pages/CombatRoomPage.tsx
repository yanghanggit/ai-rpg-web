import { useNavigate } from "react-router";
import type { Schemas } from "../api/types";
import CombatRoomPanel from "../features/dungeon/combat/CombatRoomPanel";
import RoomScaffold from "../features/dungeon/RoomScaffold";

/**
 * 战斗房间整页（`room.type === "combat"`）。
 *
 * 与 `OpeningRoomPage` 共用 `RoomScaffold`（标题 / 副本信息 / 叙事 / 离开副本），
 * 这里只接战斗房间的正文 `CombatRoomPanel`（按 `combat.state` 派生阶段 → 渲染对应面板，
 * 详见该组件注释），以及本间**结束动作的去处**：回地图（`onFinishRoom`）。
 *
 * 「离开副本」**不**预判：战斗未结束时退出由后端拦（错误原样显示），所以不传 `exitBlocked`
 * ——`readRoomGuards` 对战斗房间也恒返回 `exitBlocked: false`，这里干脆不接那根线。
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

  return (
    <RoomScaffold userName={userName} gameName={gameName} roomName={room.stage.name}>
      <CombatRoomPanel
        userName={userName}
        gameName={gameName}
        room={room}
        // 副本内一律 replace：没有"后退"，只有前进与放弃离开（见 DungeonMapPanel）
        onFinishRoom={() =>
          navigate(`/game/${userName}/${gameName}/dungeon/map`, { replace: true })
        }
      />
    </RoomScaffold>
  );
}
