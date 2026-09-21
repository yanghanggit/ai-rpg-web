import { useNavigate } from "react-router";
import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import DungeonRoomList, { type DungeonRoomRow } from "../DungeonRoomList";
import { readDungeonInfo } from "../readDungeonInfo";
import { readRoomGuards } from "../readRoomGuards";
import { useAdvanceStage } from "../useAdvanceStage";
import { useDungeonRun } from "../useDungeonRun";

/**
 * 副本地图（正文；整页是 `pages/DungeonMapPage`）——**房间之间那一站**。
 *
 * **地图是唯一能改变队伍位置的地方**。房间（开场 / 战斗）在自己"位置"这件事上是只读的：它们只能做
 * 自己那摊事（初始化、出牌、结算、领奖励），结束动作只负责结束本间，然后把队伍送到这里。
 * 「前进」（`advance_stage`）只发生在地图上。今天下一间是**唯一**候选，所以看着像可以省略；
 * 但它是那个"接缝"——将来地图变成选路（多个候选）时，长出来的就是这里，而不是房间页。
 *
 * 于是地图只有三种状态：
 * 1. **刚进入副本**（还没进第 1 间）：目标行 = 本间，按钮「进入房间」；
 * 2. **两间之间**（本间已结束、还有下一间）：目标行 = 下一间，按钮「前往下一间」；
 * 3. **没有可前往的房间**（通关 / 打输）：没有任何行带按钮，只留一句话指路——正常流程走不到这里，
 *    房间的结束动作在这种情况下直接离开副本（见两个房间页），这里是 URL / 收藏这类落点的兜底。
 *
 * **动作长在目标那一行**，不再另开一条工具栏：按钮摆在哪一行，就同时说明了"能去哪"与"只能去哪"
 * （将来多候选时，就是多行各带一颗）。所以也不需要"本间尚未结束，请先打完"这类说明句——
 * 本间没结束时，带按钮的就是本间那一行。
 *
 * 战斗没结束时地图根本不该出现（队伍就在那间房里，这里唯一能做的"回房间"本来就是它该待的地方）：
 * 整页那层会把这个状态**转发**回房间，见 `DungeonMapPage`。
 *
 * 另一个后果是**故意的**：本间一结束，"进入本间"就不再出现，那一间自然回不了头。代价是
 * **未领的开场奖励 / 未收的战斗战利品永久失去**（服务端把两者都硬绑在"当前房间"上：
 * `activate_pick_spoils_card` 要求 `is_current_room_dungeon_opening`，`collect_loot` 要求
 * `is_current_room_dungeon_combat`）——惩罚是设计要的，所以房间的结束动作只**提示**不阻止
 * （提示在房间里，因为只有那里有"还有多少没领"的数据）。
 *
 * 屏幕切换一律 `replace`：副本内没有"后退"这个概念，只有前进和放弃离开（历史栈里不该留下可以
 * 倒退着回去的房间）。所以浏览器返回键不会让你从房间里溜到地图上。
 *
 * 「有没有可前往的房间」由 `readRoomGuards` + `readNextRoom` 从**本间状态**直接得出（不是服务端
 * 规则的镜像）；点下去后端仍会重新判一次，失败原因原样显示。
 */
export default function DungeonMapPanel({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  /** 当前房间（`GET .../room`）：队伍"刚离开 / 正要进入"的那一间。 */
  room: Schemas["DungeonRoomResponse"]["room"];
}) {
  const navigate = useNavigate();
  const run = useDungeonRun(userName, gameName);
  const advance = useAdvanceStage(userName, gameName);

  const guards = readRoomGuards(room);
  const dungeon = run.data?.dungeon ?? null;
  // 房间表来自 `/state`：拿到之前不知道有几间、目标是谁，所以整块动作先不出现
  // （比"先画一颗不知道能不能点的按钮"诚实）
  const info = dungeon === null ? null : readDungeonInfo(dungeon);
  const rooms = info?.rooms ?? [];
  const currentIndex = dungeon?.current_room_index ?? -1;

  const roomPath = `/game/${userName}/${gameName}/dungeon/room`;

  // 目标那一行：还没进过本间（刚进入副本）→ 本间；本间已结束 → 下一间
  const targetIndex = guards.done ? currentIndex + 1 : currentIndex;
  // 打输了就没有"下一间"这回事（服务端也不许推进，"打输了"与"通关了"是两种不同的处境）
  const canGo = (rooms[targetIndex] ?? undefined) !== undefined && !guards.defeated;

  /** 走这一步：还没进过本间就直接进去；本间已结束就先**在这里**前进（唯一移动队伍的地方）。 */
  function go() {
    if (!guards.done) {
      navigate(roomPath, { replace: true });
      return;
    }
    // `useAdvanceStage` 已经等副本三条查询重取落地，所以这里换屏不会先闪一下上一间
    advance.mutate(undefined, { onSuccess: () => navigate(roomPath, { replace: true }) });
  }

  const rows: DungeonRoomRow[] = rooms.map((infoRoom, index) => {
    const isCurrent = index === currentIndex;
    const isTarget = index === targetIndex && canGo;
    return {
      room: infoRoom,
      current: isCurrent,
      // 队伍所在那一行：还没进过就是"你在这里"，已经打完了就是"已完成"（两种都是事实，
      // 地图的方向由带按钮的那一行给出，不靠"本间已结束"这种回头看的话）
      status: isCurrent
        ? guards.done
          ? "已完成"
          : "你在这里"
        : index < currentIndex
          ? "已完成"
          : undefined,
      action: isTarget
        ? {
            label: guards.done ? "前往下一间" : "进入房间",
            title: guards.done
              ? `前往下一间：${displayName(infoRoom.stageName)}（推进后回不了本间）`
              : `进入房间：${displayName(infoRoom.stageName)}`,
            busy: advance.isPending,
            onActivate: go,
          }
        : undefined,
    };
  });

  // 没有任何行带按钮（通关 / 打输）时才需要一句话：正常流程走不到，房间的结束动作会直接离开副本
  const deadEnd = !canGo
    ? guards.defeated
      ? "战斗失败：无法前往下一间，只能离开副本。"
      : "副本已全部通关：用「副本操作」里的「离开副本」回家园。"
    : null;

  return (
    <section aria-labelledby="dungeon-map-heading">
      <div className="section-head">
        <h2 id="dungeon-map-heading">地图</h2>
        {info === null || info.progress === null ? null : (
          <span className="muted">{info.progress}</span>
        )}
      </div>

      {run.isPending ? <p className="muted">加载中…</p> : null}
      {run.isError ? (
        <p className="error">无法获取副本进度：{describeApiError(run.error)}</p>
      ) : null}
      {advance.isError ? (
        <p className="error">前往下一间失败：{describeApiError(advance.error)}</p>
      ) : null}

      {rooms.length === 0 ? null : <DungeonRoomList rows={rows} />}

      {deadEnd === null ? null : <p className="muted">{deadEnd}</p>}
    </section>
  );
}
