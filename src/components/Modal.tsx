import { type ReactNode, useEffect, useId, useRef } from "react";

/**
 * 通用浮层：遮罩 + 居中面板。
 *
 * 契约：点遮罩 / ESC 关闭、打开时焦点移到关闭按钮、打开期间锁背景滚动。手写而不用原生
 * `<dialog>`（jsdom 没有 `showModal`，用了就没法做组件测试）。
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
  /** 面板宽度变体；`sm` 给内容少的菜单类浮窗（避免右侧大片留白）；
   *  `cards` 给卡牌列表浮窗（牌组 / 手牌 / 牌堆）：宽度以**卡牌为度量**（正好三张卡），
   *  不跟着卡数变——三个浮窗打开就是同一个框，位置不必重新找；
   *  `lg` 给内容多的浮窗（如地图：整份房间与敌人清单）。 */
  size?: "default" | "sm" | "cards" | "lg";
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelClass = size === "default" ? "overlay-panel" : `overlay-panel overlay-panel--${size}`;

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
