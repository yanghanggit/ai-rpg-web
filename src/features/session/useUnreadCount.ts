import { useEffect, useSyncExternalStore } from "react";
import { getUnreadBaseline, setUnreadBaseline, subscribeUnreadBaseline } from "./unreadBaselines";

/**
 * 未读事件数：服务端已经有的消息里，客户端还没打开浮层看过的条数。
 *
 * 三条规则：
 *
 * 1. **某个会话第一次看到数据时，把当时已有的历史记为已看基线**。否则一进页面就是满屏
 *    未读，"有新消息"这个提示就失去意义了——它要表达的是"你看着看着，又来了新的"。
 * 2. **基线跨屏存活**（存在模块级的 `unreadBaselines`，见那里的说明）。从家园进副本、
 *    再从副本回家园，两次挂载共用同一条基线，所以副本期间产生的事件在家园页仍显示为未读。
 * 3. **打开浮层即视为已读**；浮层开着期间持续同步，因此一边翻看一边新到的消息不会被
 *    标成未读。
 *
 * 不做持久化：刷新页面后基线重新建立（有意为之，暂不落 localStorage）。
 *
 * @param session 会话 key（`sessionKey(userName, gameName)`），未读基线按它隔离
 * @param total 客户端当前持有的消息总数（等价于服务端已有的总数）
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

  // 数据刚到位那一刻：若这个会话还没有基线，把当时已有的历史记为「已看」。
  // 已经有基线就不动——它可能来自上一次访问（同一会话的另一屏），那正是跨屏未读要保留的。
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
