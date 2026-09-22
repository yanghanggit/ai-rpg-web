import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CardMark } from "./cardMarks";

/** 浮层与视口边缘 / 与标记之间留的空隙。 */
const MARGIN = 8;
const GAP = 8;

/**
 * 标记说明小浮层（tooltip）：点卡面上的**词缀或布尔标记**时回答"这是什么"。
 *
 * **为什么不用 CSS 气泡（`:hover::after`）**：战斗手牌在 `overflow-x: auto` 里、外面那层
 * `.combat-hand` 还 `overflow: hidden`——挂在 chip 上的气泡会被**裁掉**。所以这里走
 * `position: fixed` + 量出来的坐标，天然不受祖先裁剪影响（代价是要自己管关闭时机）。
 *
 * 位置：优先贴在标记**上方**（上方放不下就翻到下方），水平以标记为轴居中、再夹进视口。
 * 宽度得等渲染出来才知道，所以先渲染到 `(0,0)`、在 `useLayoutEffect` 里量到再摆：
 * layout effect 在浏览器绘制**之前**跑完，所以不会真的闪一下（也不需要 `visibility` 先去隐）。
 *
 * 关闭时机：点浮层外部 / ESC / 页面滚动（含手牌那条横向滚动）。它只是"看一眼"的东西，
 * 不该在页面上粘住——所以由 `CardItem` 持状态，不上升成浮窗层级。
 *
 * 外部关闭听的是 **`mousedown`** 而不是 `click`：它比 click 早一步，所以"点另一枚 chip"会
 * 先关旧的、再由那枚 chip 的 onClick 开新的，不需要额外判"这是不是自己人"。
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
    // 点浮层之外的地方即关。用 `mousedown`（早于 click）：这样点**另一枚 chip** 时，
    // 先关掉旧的、再由那枚 chip 自己的 onClick 开新的，不必在这里判"是不是同一张卡"。
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
