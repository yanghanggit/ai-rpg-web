import { useState } from "react";
import NarrativeOverlay from "./NarrativeOverlay";
import { sessionKey } from "./sessionKey";
import { useSessionMessages } from "./useSessionMessages";
import { useUnreadCount } from "./useUnreadCount";

/**
 * 「叙事」入口：一个带「已看 / 总共」计数的通知按钮 + 「全部叙事」浮层。
 *
 * 家园页与副本房间页**共用这一个组件**：叙事是**会话级**资源（本局所有事件），
 * 不属于任何一屏或任何房间类型，所以入口的长相与未读算法都只有一份。
 * 按钮右侧大于左侧即「有新事件没看」，用颜色表达，页面上不再写一句提示文案。
 */
export default function NarrativeButton({
  userName,
  gameName,
}: {
  userName: string;
  gameName: string;
}) {
  const session = useSessionMessages(userName, gameName);
  const [isOpen, setIsOpen] = useState(false);

  const total = session.messages.length;
  const unread = useUnreadCount(sessionKey(userName, gameName), total, session.hasLoaded, isOpen);
  const seen = total - unread;

  return (
    <>
      <button
        type="button"
        className={unread > 0 ? "count-button count-button--unread" : "count-button"}
        title={unread > 0 ? `有 ${unread} 条新事件未查看` : "没有新事件"}
        aria-label={`查看叙事事件（已看 ${seen} 条，共 ${total} 条）`}
        onClick={() => setIsOpen(true)}
      >
        叙事 {seen} / {total}
      </button>
      {isOpen ? (
        <NarrativeOverlay messages={session.messages} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
