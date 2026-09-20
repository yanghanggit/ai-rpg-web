import Modal from "../../components/Modal";

/**
 * 「副本操作」浮窗：把房间页顶部原来的三个动作（副本信息 / 叙事 / 离开副本）收进一个入口，
 * **整行可点**（标签在左、状态在右），面板用 `size="sm"` 收窄，避免内容少而右侧一大片留白。
 *
 * **本组件不开子浮窗**——点某一项只回调，由 `RoomScaffold` 用单一 state 做「切换」：
 * 先关菜单、再开对应浮窗，所以永远只有一层浮层（对照 docs/pages.md「同类切换不叠第三层」）。
 *
 * 「离开副本」是**直接触发**（不再二次确认），但服务端会在任务里按房间/时机拦截
 * （`dungeon_exit_action.py`：开场未初始化、战斗未结束、没有当前房间）。客户端只把**确定已知**
 * 的一种情况（`exitBlocked`）反映成禁用；其余交给后端，失败原因由页面显示。
 */
export default function RoomActionsDialog({
  canOpenInfo,
  infoMeta,
  exitBlocked,
  exitBlockedHint,
  exitBusy,
  narrative,
  onOpenInfo,
  onOpenNarrative,
  onExit,
  onClose,
}: {
  /** `/state` 是否已回来（没回来时「副本信息」没有内容可展示）。 */
  canOpenInfo: boolean;
  /** 「副本信息」右侧的进度，如「第 1 / 2 间」。 */
  infoMeta?: string;
  exitBlocked: boolean;
  exitBlockedHint?: string;
  exitBusy: boolean;
  narrative: { seen: number; total: number; unread: number };
  onOpenInfo: () => void;
  onOpenNarrative: () => void;
  onExit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="副本操作" size="sm" onClose={onClose}>
      <ul className="action-list">
        <li>
          <button type="button" disabled={!canOpenInfo} onClick={onOpenInfo}>
            副本信息
          </button>
          {canOpenInfo && infoMeta ? <span className="action-meta">{infoMeta}</span> : null}
        </li>

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

        <li>
          <button
            type="button"
            disabled={exitBusy || exitBlocked}
            title={exitBlocked ? exitBlockedHint : undefined}
            onClick={onExit}
          >
            {exitBusy ? "退出中…" : "离开副本"}
          </button>
        </li>
      </ul>
    </Modal>
  );
}
