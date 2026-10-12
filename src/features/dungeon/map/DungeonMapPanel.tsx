import { useNavigate } from "react-router";
import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import DungeonRoomList, { type DungeonRoomRow } from "../DungeonRoomList";
import { readDungeonInfo } from "../readDungeonInfo";
import { readRoomGuards } from "../readRoomGuards";
import { useDungeonRun } from "../useDungeonRun";
import { useAdvanceStage } from "./useAdvanceStage";

/**
 * 副本地图正文——房间之间那一站，也是唯一能改变队伍位置的地方（`advance_stage` 只在这里发）。
 *
 * 目标行 = 刚进副本时是本间、本间已结束后是下一间，动作按钮就长在那一行；没有可前往的房间
 * （通关 / 打输）时不留按钮，只给一句指路。战斗未结束时整页转发回房间，见 `DungeonMapPage`。
 */
export default function DungeonMapPanel({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  /** 当前房间（`GET .../room`）：队伍「刚离开 / 正要进入」的那一间。 */
  room: Schemas["DungeonRoomResponse"]["room"];
}) {
  const navigate = useNavigate();
  const run = useDungeonRun(userName, gameName);
  const advance = useAdvanceStage(userName, gameName);

  const guards = readRoomGuards(room);
  const dungeon = run.data?.dungeon ?? null;
  // 房间表来自 `/state`：拿到之前不知道目标是谁，整块动作先不出现
  const info = dungeon === null ? null : readDungeonInfo(dungeon);
  const rooms = info?.rooms ?? [];
  const currentIndex = dungeon?.current_room_index ?? -1;

  const roomPath = `/game/${userName}/${gameName}/dungeon/room`;

  // 还没进过本间 → 目标本间；本间已结束 → 目标下一间
  const targetIndex = guards.done ? currentIndex + 1 : currentIndex;
  const canGo = (rooms[targetIndex] ?? undefined) !== undefined && !guards.defeated;

  /** 还没进过本间就直接进去；本间已结束就先在这里前进（唯一移动队伍的地方）。 */
  function go() {
    if (!guards.done) {
      navigate(roomPath, { replace: true });
      return;
    }
    advance.mutate(undefined, { onSuccess: () => navigate(roomPath, { replace: true }) });
  }

  const rows: DungeonRoomRow[] = rooms.map((infoRoom, index) => {
    const isCurrent = index === currentIndex;
    const isTarget = index === targetIndex && canGo;
    return {
      room: infoRoom,
      current: isCurrent,
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

  // 没有任何行带按钮（通关 / 打输）时才需要一句指路
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
