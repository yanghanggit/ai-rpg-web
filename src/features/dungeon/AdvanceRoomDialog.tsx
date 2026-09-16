import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { ROOM_TYPE_LABELS } from "./readDungeonInfo";

/**
 * 「进入下一关」的确认框。
 *
 * 为什么要有：推进**不可逆**——副本只向前，进了下一间就回不来，所以这是一步要确认的动作。
 *
 * 里面列一句准备状态，**只提示、不阻止**：后端允许空手推进（`advance_stage` 对开场房间
 * 没有「必须已初始化 / 已挑卡」的前置），所以客户端不替它拦，只把事实摆出来让玩家自己决定。
 */
export default function AdvanceRoomDialog({
  currentRoomName,
  nextRoom,
  initialized,
  spoilsPending,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  /** 当前房间名（`room.stage.name`）。 */
  currentRoomName: string;
  /** 下一间房间；`null` = 没有下一间（后端会 409「副本已全部通关」）。 */
  nextRoom: Schemas["DungeonRoomResponse"]["room"] | null;
  initialized: boolean;
  /** 是否还有**未领取**的奖励（Spoils）候选（没有就说明尚未生成或已领完）。 */
  spoilsPending: boolean;
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
        <dt>开场准备</dt>
        <dd>
          初始化 {initialized ? "已完成" : "未完成"} · 奖励{" "}
          {spoilsPending ? "还有候选待挑" : "暂无候选"}
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
