import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { Schemas } from "../api/types";
import { hasUnclaimedRewards } from "../features/dungeon/opening/hasUnclaimedRewards";
import OpeningRoomPanel from "../features/dungeon/opening/OpeningRoomPanel";
import { useOpeningActions } from "../features/dungeon/opening/useOpeningActions";
import { useOpeningParty } from "../features/dungeon/opening/useOpeningParty";
import RoomScaffold, { type RoomAction } from "../features/dungeon/RoomScaffold";
import { readRoomGuards } from "../features/dungeon/readRoomGuards";

/**
 * 开场房间整页（`room.type === "opening"`）。
 *
 * 与 `CombatRoomPage` 共用 `RoomScaffold`（标题 / 副本信息 / 叙事 / 离开副本），
 * 这里只写**开场房间与别的房间不同的那三件事**：
 * - 「离开副本」的前置禁用（服务端要求先初始化完才能退出）——判据统一走 `readRoomGuards`；
 * - **本间的主行动**（标题行最右那颗状态相关的图标）：初始化中 / 重试初始化 / 结束本间。
 *   它是开场房间特有的两态：还没初始化时唯一的动作就是「把它跑起来」，能走了才是「结束本间」；
 * - 所以**本间的数据与动作由页面持有**：`useOpeningActions` 只允许一个实例（见该 hook 注释），
 *   队伍也一样取一次往下传——因为那颗「结束本间」要变身提醒色得先知道**还有奖励没领**
 *   （`hasUnclaimedRewards`，与角色卡上那颗按钮同一份判据）。自动初始化也在这里发起。
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
  const guards = readRoomGuards(room);
  const actions = useOpeningActions(userName, gameName);
  const party = useOpeningParty(userName, gameName);

  // 自动初始化只对「本房间」触发一次：ref 记住已触发过的房间标识——StrictMode 下 effect 跑两次、
  // 或轮询导致重渲染都不会重复发任务；失败后不自动重试，改由标题行那颗图标手动重试。
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

  // 还有人没领奖励 → 「结束本间」也该是提醒色：那一步一按，没领的卡就永久失去了
  const unclaimed = party.party.some(hasUnclaimedRewards);

  /**
   * 标题行那颗「本间主行动」图标的三态（图标只看字形，动作名在 `label` / `title` 里）。
   *
   * 三态其实是**两件事**：未初始化时只有「初始化」（自动跑着 → 转；失败了 → 重试），
   * 初始化完成后才是「结束本间」。不加第三个按钮：同一时刻只有一件事可做。
   */
  function readAction(): RoomAction {
    if (room.initialized) {
      return {
        icon: "→",
        label: "结束开局准备",
        title: unclaimed
          ? "结束开局准备（回到地图）—— 还有候选卡未领，结束本间后就无法再领取了。"
          : "结束开局准备（回到地图）—— 本间结束后进不来。",
        tone: unclaimed ? "warn" : "plain",
        iconClass: "icon-button--leave",
        onActivate: toMap,
      };
    }
    if (actions.init.error !== null) {
      return {
        icon: "↻",
        label: "重试初始化开场",
        title: `初始化失败：${actions.init.error}`,
        tone: "err",
        iconClass: "icon-button--run",
        onActivate: () => actions.init.start(),
      };
    }
    return {
      icon: "↻",
      label: "正在初始化开场…",
      title: "正在初始化开场…",
      busy: true,
      iconClass: "icon-button--run",
      onActivate: () => actions.init.start(),
    };
  }

  return (
    <RoomScaffold
      userName={userName}
      gameName={gameName}
      roomName={room.stage.name}
      exitBlocked={guards.exitBlocked}
      exitBlockedHint={guards.exitBlockedHint ?? undefined}
      roomAction={readAction()}
    >
      <OpeningRoomPanel
        userName={userName}
        gameName={gameName}
        room={room}
        party={party}
        actions={actions}
        onFinishRoom={toMap}
      />
    </RoomScaffold>
  );
}
