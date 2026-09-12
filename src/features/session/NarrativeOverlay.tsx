import { useEffect, useRef } from "react";
import type { Schemas } from "../../api/types";
import SessionMessageList from "./SessionMessageList";

/**
 * 「全部叙事」浮层：盖在家园概览之上，滚动查看本局的所有事件。
 *
 * 为什么不直接用原生 `<dialog>` + `showModal()`：jsdom（测试环境）尚未实现
 * `showModal`，用了就没法做组件测试。这里自己实现需要的几件事——遮罩点击关闭、
 * ESC 关闭、打开时把焦点移进浮层、锁住背景滚动——加起来不到 20 行。
 *
 * 遮罩做成一个真正的 `<button>`（而不是带 onClick 的 div）：它就是一个"点这里关闭"
 * 的可聚焦控件，既符合无障碍语义，也避免在非交互元素上挂点击事件。
 */
export default function NarrativeOverlay({
  messages,
  onClose,
}: {
  messages: Schemas["SessionMessage"][];
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 打开时把焦点移进浮层：键盘用户不必先 Tab 穿过后面的整页内容
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 浮层打开期间锁住背景滚动，否则滚轮会穿透到后面的页面
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="overlay">
      <button type="button" className="overlay-backdrop" aria-label="关闭浮层" onClick={onClose} />

      <div
        className="overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="narrative-overlay-heading"
      >
        <div className="overlay-head">
          <h2 id="narrative-overlay-heading">全部叙事</h2>
          <span className="muted">共 {messages.length} 条</span>
          <button type="button" ref={closeButtonRef} onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="overlay-body">
          <SessionMessageList messages={messages} emptyHint="这一局还没有产生任何事件。" />
        </div>
      </div>
    </div>
  );
}
