import { useEffect, useRef, useState } from "react";

/**
 * 未读事件数：服务端已经有的消息里，客户端还没打开浮层看过的条数。
 *
 * 两条规则：
 *
 * 1. **首屏已有的历史不算未读**。否则一进页面就是满屏未读，"有新消息"这个提示就失去
 *    意义了——它要表达的是"你看着看着，又来了新的"。所以首次拿到数据时，把当时的总数
 *    记为已看基线。
 * 2. **打开浮层即视为已读**；浮层开着期间持续同步，因此一边翻看一边新到的消息不会被
 *    标成未读。
 *
 * 不做持久化：刷新页面后基线重新建立。将来真要跨会话记住"读到哪了"，再考虑 localStorage
 * 或让后端记录。
 *
 * @param total 客户端当前持有的消息总数（等价于服务端已有的总数）
 * @param isReady 首屏数据是否已到达
 * @param isOpen 叙事浮层是否打开
 */
export function useUnreadCount(total: number, isReady: boolean, isOpen: boolean): number {
  const [seenCount, setSeenCount] = useState(0);
  const wasReady = useRef(false);

  // 数据刚到位那一刻：把当时已有的历史记为「已看」基线。
  // 用 wasReady 而不是一次性的 ref，这样切换会话（isReady 回落再抬起）时会重记基线。
  useEffect(() => {
    if (isReady && !wasReady.current) {
      setSeenCount(total);
    }
    wasReady.current = isReady;
  }, [isReady, total]);

  useEffect(() => {
    if (isOpen) {
      setSeenCount(total);
    }
  }, [isOpen, total]);

  return Math.max(0, total - seenCount);
}
