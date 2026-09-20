import { type ReactNode, useEffect, useId, useRef } from "react";

/**
 * 通用浮层：遮罩 + 居中面板。负责四件容易被漏掉的事——
 * 点遮罩关闭、ESC 关闭、打开时把焦点移进关闭按钮、打开期间锁住背景滚动。
 *
 * 为什么不用原生 `<dialog>` + `showModal()`：jsdom（测试环境）尚未实现 `showModal`，
 * 用了就没法做组件测试。这里自己实现需要的部分。
 *
 * 遮罩做成一个真正的 `<button>` 而非带 onClick 的 div：它本来就是"点这里关闭"的
 * 可聚焦控件，语义正确，也避免在非交互元素上挂点击事件。
 */
export default function Modal({
  title,
  meta,
  size = "default",
  onClose,
  children,
}: {
  title: string;
  /** 标题右侧的补充信息，如「共 12 条」。 */
  meta?: string;
  /** 面板宽度变体；`sm` 给内容少的菜单类浮窗（避免右侧大片留白）。 */
  size?: "default" | "sm";
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelClass = size === "sm" ? "overlay-panel overlay-panel--sm" : "overlay-panel";

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

  // 锁住背景滚动，否则滚轮会穿透到后面的页面
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

      <div className={panelClass} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="overlay-head">
          <h2 id={titleId}>{title}</h2>
          {meta ? <span className="muted">{meta}</span> : null}
          <button type="button" ref={closeButtonRef} onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="overlay-body">{children}</div>
      </div>
    </div>
  );
}
