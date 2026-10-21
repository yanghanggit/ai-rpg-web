import { useState } from "react";
import NarrativeOverlay from "./NarrativeOverlay";
import { useNarrative } from "./useNarrative";

/**
 * 「叙事」入口：带「已看 / 总共」计数的通知按钮 + 「全部叙事」浮层（家园页用）。
 *
 * 副本房间页把入口折进了「副本操作」菜单，但两处的数据与未读算法共用 `useNarrative`、浮层共用
 * `NarrativeOverlay`——叙事是**会话级**资源，不属于任何一屏或房间类型。
 */
export default function NarrativeButton({
  userName,
  gameName,
}: {
  userName: string;
  gameName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, seen, total, unread } = useNarrative(userName, gameName, isOpen);

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
      {isOpen ? <NarrativeOverlay messages={messages} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
