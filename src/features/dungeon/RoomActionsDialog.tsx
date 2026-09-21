import Modal from "../../components/Modal";

/**
 * 「副本操作」浮窗：房间页标题行齿轮入口下的动作清单——**叙事 / 离开副本**，当前是战斗房时
 * 再多一行**战斗信息**（状态 / 回合 / 结果写在右侧，点开是全部回合的 `Round` 明细）。
 * **整行可点**（标签在左、状态在右），面板用 `size="sm"` 收窄，避免内容少而右侧一大片留白。
 *
 * 「战斗信息」放在这里而不是标题行的独立图标，是因为它属于**战斗房自己的东西**（与「叙事」一样是
 * 菜单里的一项），而且**所有战斗 phase 都用同一入口**：菜单只按「有没有战斗数据」加这一行，
 * 初始化 / 回合开始 / 行动 / 结算哪一阶段都能开。
 *
 * 「地图」（旗帜 ⚑）不在这个菜单里：它本质是「房间清单 + 当前进度」，属于**只读浏览**，所以和
 * 「牌组」一样做成标题行上与齿轮平级的图标入口（见 `RoomScaffold`）。
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

        {/* 战斗房专属一行：战斗的宏观状态与回合明细（所有 phase 都能开） */}
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
