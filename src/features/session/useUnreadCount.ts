import { useEffect, useSyncExternalStore } from "react";
import { getUnreadBaseline, setUnreadBaseline, subscribeUnreadBaseline } from "./unreadBaselines";

/**
 * 未读事件数：服务端已有消息里、客户端还没打开浮层看过的条数。
 *
 * 某个会话第一次看到数据时把当时的历史记为已看基线（基线跨屏存活于 `unreadBaselines`）；
 * 打开浮层即视为已读。不做持久化，刷新后重建。
 *
 * @param session 会话 key，未读基线按它隔离
 * @param total 客户端当前持有的消息总数
 * @param isReady 首屏数据是否已到达
 * @param isOpen 叙事浮层是否打开
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
