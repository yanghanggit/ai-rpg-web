import Modal from "../../components/Modal";

/**
 * 「副本操作」浮窗：叙事 / 离开副本，战斗房再多一行「战斗信息」。整行可点，`size="sm"`。
 *
 * 本组件不开子浮窗——点某项只回调，由 `RoomScaffold` 用单一 state 做切换，永远只有一层。
 * 「离开副本」直接触发，能不能走由服务端拦，原因由页面显示。
 */
export default function RoomActionsDialog({
  exitBusy,
  combatSummary,
  narrative,
  onOpenNarrative,
  onOpenCombat,
  onExit,
  onClose,
}: {
  exitBusy: boolean;
  /** 战斗房的「状态 · 第 N 回合 · 结果」摘要；非战斗房为 `null`（那一行不出现）。 */
  combatSummary: string | null;
  narrative: { seen: number; total: number; unread: number };
  onOpenNarrative: () => void;
  onOpenCombat: () => void;
  onExit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="副本操作" size="sm" onClose={onClose}>
      <ul className="action-list">
        <li>
          <button type="button" onClick={onOpenNarrative}>
            叙事
          </button>
          <span
            className={narrative.unread > 0 ? "action-meta action-meta--unread" : "action-meta"}
          >
            已看 {narrative.seen} / 共 {narrative.total}
            {narrative.unread > 0 ? ` · ${narrative.unread} 条新` : ""}
          </span>
        </li>

        {/* 战斗房专属一行（所有 phase 都能开） */}
        {combatSummary === null ? null : (
          <li>
            <button type="button" onClick={onOpenCombat}>
              战斗信息
            </button>
            <span className="action-meta">{combatSummary}</span>
          </li>
        )}

        <li>
          <button type="button" disabled={exitBusy} onClick={onExit}>
            {exitBusy ? "退出中…" : "离开副本"}
          </button>
        </li>
      </ul>
    </Modal>
  );
}
