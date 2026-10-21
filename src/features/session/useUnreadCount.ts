import { useEffect, useSyncExternalStore } from "react";
import { getUnreadBaseline, setUnreadBaseline, subscribeUnreadBaseline } from "./unreadBaselines";

/**
 * 未读事件数：服务端已有、客户端还没打开浮层看过的消息条数。
 *
 * 首次拿到数据时把当时的历史记为基线（存于 `unreadBaselines`），打开浮层即视为已读。
 * 不持久化，刷新后重建。
 */
export function useUnreadCount(
  session: string,
  total: number,
  isReady: boolean,
  isOpen: boolean,
): number {
  const baseline = useSyncExternalStore(subscribeUnreadBaseline, () => getUnreadBaseline(session));

  // 数据刚到位那一刻：还没有基线就把当时的历史记为「已看」（有基线则不动，那正是跨屏未读要保留的）
  useEffect(() => {
    if (isReady && getUnreadBaseline(session) === undefined) {
      setUnreadBaseline(session, total);
    }
  }, [session, isReady, total]);

  useEffect(() => {
    if (isOpen) {
      setUnreadBaseline(session, total);
    }
  }, [session, isOpen, total]);

  return Math.max(0, total - (baseline ?? total));
}
