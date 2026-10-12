import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CardMark } from "./cardMarks";

/** 浮层与视口边缘 / 与标记之间留的空隙。 */
const MARGIN = 8;
const GAP = 8;

/**
 * 标记说明小浮层（tooltip）：点卡面的词缀 / 布尔标记时说明它。
 *
 * 走 `position: fixed` + 量出的坐标，避免被手牌那层 `overflow` 裁掉。优先贴上、放不下翻下方，
 * 水平夹进视口。点外部 / ESC / 滚动即关；外部关闭听 `mousedown`（早于 click），
 * 这样点另一枚 chip 会先关旧的、再开新的。
 */
export default function CardMarkTip({
  id,
  mark,
  anchor,
  onClose,
}: {
  /** `aria-describedby` 指向的 id（由 `CardItem` 生成）。 */
  id: string;
  mark: CardMark;
  /** 贴着哪一枚标记（chip 元素本身）。 */
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (tip === null) {
      return;
    }
    const place = () => {
      const chip = anchor.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const left = Math.min(
        Math.max(MARGIN, chip.left + chip.width / 2 - box.width / 2),
        // 视口比浮层还窄时 `max` 兜住，宁可贴左边也不让它跑出去
        Math.max(MARGIN, window.innerWidth - box.width - MARGIN),
      );
      const above = chip.top - box.height - GAP;
      setPos({ left, top: above >= MARGIN ? above : chip.bottom + GAP });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    // 点浮层之外即关。用 `mousedown`（早于 click）：点另一枚 chip 会先关旧的、再开新的
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && tipRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    // 捕获阶段：手牌那条横向滚动不会冒泡到 window
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={tipRef}
      id={id}
      role="tooltip"
      className="card-mark-tip"
      style={{ left: pos.left, top: pos.top }}
    >
      <span className="card-mark-tip-head">
        {/* 分类（标记 / 打出时 / …）+ 名称，与卡面、详情右栏用的是同一对 chip */}
        <span className={`affix-chip affix-chip--${mark.tone}`}>{mark.group}</span>
        <span className={`affix-chip affix-chip--${mark.tone}`}>{mark.label}</span>
      </span>
      <span className="card-mark-tip-text">{mark.hint}</span>
    </div>
  );
}
