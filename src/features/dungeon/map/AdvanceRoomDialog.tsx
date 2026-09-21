import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import Modal from "../../../components/Modal";
import { ROOM_TYPE_LABELS } from "../readDungeonInfo";

/**
 * 「进入下一关」的确认框（地图页专用）。
 *
 * 为什么要有：推进**不可逆**——副本只向前（服务端 `current_room_index` 只会 `+1`，没有任何接口
 * 能回退），进了下一间就回不来，所以这是一步要确认的动作。
 *
 * 为什么在地图上而不在房间里：地图上"前往下一间"是**整局副本唯一的前进动作**，也是选下一间房间
 * 的地方（`rooms[current_room_index + 1]`）。看似能选，其实目前恒为一间——这个框就是那次确认。
 *
 * 只展示"当前 → 下一间"，**不展示开场奖励状态**：奖励候选在队伍成员身上，只有开场房间手里有
 * 那份数据（`opening/useOpeningParty`），地图页不该为了这一行去拉队伍。奖励提醒归开场房间自己
 * 的结束动作（那里既有数据、也正是会发生损失的那一刻）。
 */
export default function AdvanceRoomDialog({
  currentRoomName,
  nextRoom,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  /** 当前房间名（`room.stage.name`）。 */
  currentRoomName: string;
  /** 下一间房间；`null` = 没有下一间（后端会 409「副本已全部通关」）。 */
  nextRoom: Schemas["DungeonRoomResponse"]["room"] | null;
  /** 提交中（请求 + 重取）：禁用两个按钮，避免重复发起。 */
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const nextName = nextRoom === null ? null : displayName(nextRoom.stage.name);

  return (
    <Modal
      title="进入下一关"
      meta={`${displayName(currentRoomName)}${nextName === null ? "" : ` → ${nextName}`}`}
      onClose={onClose}
    >
      <dl className="facts">
        <dt>下一间</dt>
        <dd>
          {nextRoom === null ? (
            "已经没有下一间了"
          ) : (
            <>
              <span className="mono">{displayName(nextRoom.stage.name)}</span>{" "}
              <span className={nextRoom.type === "combat" ? "badge badge--combat" : "badge"}>
                {ROOM_TYPE_LABELS[nextRoom.type] ?? nextRoom.type}
              </span>
            </>
          )}
        </dd>
      </dl>

      {error ? <p className="error">进入下一关失败：{error}</p> : null}

      <div className="modal-actions">
        <button type="button" disabled={busy} onClick={onConfirm}>
          进入下一关
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  );
}
