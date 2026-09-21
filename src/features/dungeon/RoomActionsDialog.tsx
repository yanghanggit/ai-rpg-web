import Modal from "../../components/Modal";

/**
 * 「副本操作」浮窗：房间页标题行齿轮入口下的动作清单——**叙事 / 离开副本**。
 * **整行可点**（标签在左、状态在右），面板用 `size="sm"` 收窄，避免内容少而右侧一大片留白。
 *
 * 「副本信息」不在这个菜单里：它本质是「房间清单 + 当前进度」（地图上就是同一份清单，所以地图页
 * 不再单独给这个入口），属于**只读浏览**，所以和「牌组」
 * 一样做成标题行上与齿轮平级的图标入口（见 `RoomScaffold`）。
 *
 * **本组件不开子浮窗**——点某一项只回调，由 `RoomScaffold` 用单一 state 做「切换」：
 * 先关菜单、再开对应浮窗，所以永远只有一层浮层（对照 docs/pages.md「同类切换不叠第三层」）。
 *
 * 「离开副本」是**直接触发**（不二次确认、客户端也不预判）：能不能走由服务端拦
 * （`dungeon_exit_action.py`：开场未初始化、战斗未结束、没有当前房间），被拒的原因由页面显示
 * （退出是**任务**接口，失败可能晚于这个浮窗消失，所以提示不放在这里）。
 */
export default function RoomActionsDialog({
  exitBusy,
  narrative,
  onOpenNarrative,
  onExit,
  onClose,
}: {
  exitBusy: boolean;
  narrative: { seen: number; total: number; unread: number };
  onOpenNarrative: () => void;
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

        <li>
          <button type="button" disabled={exitBusy} onClick={onExit}>
            {exitBusy ? "退出中…" : "离开副本"}
          </button>
        </li>
      </ul>
    </Modal>
  );
}
