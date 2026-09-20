import { sessionKey } from "./sessionKey";
import { useSessionMessages } from "./useSessionMessages";
import { useUnreadCount } from "./useUnreadCount";

/**
 * 「叙事」入口的数据与未读算法。`NarrativeButton`（家园页）与副本房间的「副本操作」菜单共用，
 * 所以**未读口径只有这一份**（见 docs/pages.md「叙事入口只有一个实现」）。
 *
 * 与 `NarrativeButton` 拆开的唯一原因是**触发按钮长得不一样**：家园页是一个直接按钮，
 * 房间页把入口折进了「副本操作」菜单。浮层（`NarrativeOverlay`）与算法都复用同一份。
 *
 * @param isOpen 对应的「全部叙事」浮层是否正开着——开着即视为已读（未读算法的一部分）
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
