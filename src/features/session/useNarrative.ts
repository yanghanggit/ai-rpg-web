import { sessionKey } from "./sessionKey";
import { useSessionMessages } from "./useSessionMessages";
import { useUnreadCount } from "./useUnreadCount";

/**
 * 「叙事」入口的数据与未读算法（**唯一实现**，家园页按钮与房间「副本操作」菜单共用）。
 *
 * 与 `NarrativeButton` 拆开只因触发按钮长得不一样；浮层 `NarrativeOverlay` 与算法都复用这一份。
 *
 * @param isOpen 对应的浮层是否开着——开着即视为已读
 */
export function useNarrative(userName: string, gameName: string, isOpen: boolean) {
  const session = useSessionMessages(userName, gameName);

  const total = session.messages.length;
  const unread = useUnreadCount(sessionKey(userName, gameName), total, session.hasLoaded, isOpen);

  return {
    messages: session.messages,
    total,
    unread,
    /** 「已看」条数 = 总数 − 未读，界面上的 `已看 X / 共 Y` 由它来。 */
    seen: total - unread,
  };
}
