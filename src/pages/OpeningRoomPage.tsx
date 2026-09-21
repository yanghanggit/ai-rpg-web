import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { Schemas } from "../api/types";
import { hasUnclaimedRewards } from "../features/dungeon/opening/hasUnclaimedRewards";
import OpeningRoomPanel from "../features/dungeon/opening/OpeningRoomPanel";
import { useOpeningActions } from "../features/dungeon/opening/useOpeningActions";
import { useOpeningParty } from "../features/dungeon/opening/useOpeningParty";
import RoomScaffold, { type RoomAction } from "../features/dungeon/RoomScaffold";
import { readNextRoom } from "../features/dungeon/readNextRoom";
import { useDungeonRun } from "../features/dungeon/useDungeonRun";
import { useExitDungeon } from "../features/dungeon/useExitDungeon";

/**
 * 开场房间整页（`room.type === "opening"`）。
 *
 * 与 `CombatRoomPage` 共用 `RoomScaffold`（标题 / 副本信息 / 叙事 / 离开副本），
 * 这里只写**开场房间与别的房间不同的那两件事**：
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
  const exit = useExitDungeon(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const actions = useOpeningActions(userName, gameName);
  const party = useOpeningParty(userName, gameName);

  // 本间之后没有房间了（只剩开场房的那种副本也一样）：结束本间 = 离开副本回家园
  // （服务端 advance_stage 在这种情况下必然拒绝："副本已全部通关"）
  const finishesRun = run.data !== undefined && readNextRoom(run.data.dungeon) === null;

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

  /**
   * 「结束本间」结束之后去哪儿——**同一份描述供标题行那颗图标与正文那张卡共用**
   * （它们本来就是同一件事，不该各写一套）。
   * - 还有下一间：送到**房间之间**（地图），前进那一步在那边点（唯一能改变队伍位置的地方）；
   * - 本间之后没有房间了：直接离开副本回家园（服务端 `advance_stage` 在这种情况下必然拒绝）。
   */
  const finish = finishesRun
    ? {
        caption: "离开副本",
        hint: "这是最后一间，结束后离开副本回家园。",
        onActivate: () => exit.start(),
      }
    : {
        caption: "回到地图",
        hint: "本间结束后进不来。",
        onActivate: toMap,
      };

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
        title: `结束开局准备（${finish.caption}）—— ${
          unclaimed ? "还有候选卡未领，结束本间后就无法再领取了。" : finish.hint
        }`,
        tone: unclaimed ? "warn" : "plain",
        iconClass: "icon-button--leave",
        onActivate: finish.onActivate,
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
      exit={exit}
      roomName={room.stage.name}
      roomAction={readAction()}
    >
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
