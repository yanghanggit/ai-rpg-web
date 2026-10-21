import { type ReactNode, useId, useState } from "react";
import { displayName } from "../../components/displayName";
import CardMarkTip from "./CardMarkTip";
import type { CardMark } from "./cardMarks";
import { readCardMarks } from "./cardMarks";
import type { Card } from "./types";

/**
 * 卡牌：**「一张卡长什么样」的唯一实现**（牌组 / 手牌 / 战利品共用）。
 *
 * 调用方要守的：`onSelect` 给了才整卡可点、**含义由调用方定**（手牌＝选中待出，牌组＝打开详情）；
 * `onMarkClick` 不给就自己弹 `CardMarkTip`，给了交给调用方；`action` 只是插槽，动作属于流程；
 * 来源显示看 `hideSource` / `owner`；牌名**不走 `displayName`**（`Card.name` 没有 `类型.` 前缀）。
 * 卡面的设计语言见 docs/pages.md「卡面」。
 */
export default function CardItem({
  card,
  action,
  claimed = false,
  onSelect,
  onMarkClick,
  selected = false,
  selectAriaLabel,
  hideSource = false,
  owner,
}: {
  card: Card;
  action?: ReactNode;
  /** 该卡已被领取：加视觉标记（区别于仍在候选里的同款卡）。 */
  claimed?: boolean;
  /** 给了就整张卡可点（回调拿卡本身，调用方决定开哪层浮窗 / 选不选中）。 */
  onSelect?: (card: Card) => void;
  /**
   * 点标记：**不给就自己弹 `CardMarkTip`**（"这是什么"，任何卡面都该有）；
   * 给了就交给调用方——卡牌详情左栏用它来定位右栏那一条（那时全文已在眼前，不必再弹浮层）。
   */
  onMarkClick?: (mark: CardMark) => void;
  /** 该卡处于选中态（如战斗手牌被点选待出）：加绿框。 */
  selected?: boolean;
  /** 无障碍名字；不给就用「查看卡牌：xxx」（`onSelect` 的默认语义）。 */
  selectAriaLabel?: string;
  /** 一律不显示来源（牌组）。 */
  hideSource?: boolean;
  /** 持有者原始名：`source` 与它相同就不显示来源。 */
  owner?: string;
}) {
  /** 正开着的标记说明；`anchor` 是贴着的那枚 chip（浮层要靠它定坐标）。 */
  const [tip, setTip] = useState<{ mark: CardMark; anchor: HTMLElement } | null>(null);
  const tipId = useId();

  const isForeignSource = card.source !== "" && owner !== undefined && card.source !== owner;
  const showSource =
    !hideSource && card.source !== "" && (owner === undefined || card.source !== owner);

  /** 点标记：交给调用方，或自己弹说明（再点同一枚即收起）。 */
  const handleMarkClick = (mark: CardMark, element: HTMLElement) => {
    if (onMarkClick !== undefined) {
      onMarkClick(mark);
      return;
    }
    setTip((current) => (current?.mark.id === mark.id ? null : { mark, anchor: element }));
  };

  const content = (
    <>
      <div className="card-tile-frame">
        {/* 左上：费用 */}
        <span className="card-chip card-chip--cost" title="费用">
          <svg className="card-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="48" />
          </svg>
          <span className="card-chip-value">{card.cost}</span>
        </span>

        {/* 右下：伤害（三角，尖一些） */}
        <span className="card-chip card-chip--damage" title="伤害">
          <svg className="card-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
            <polygon points="50 4 95 93 5 93" />
          </svg>
          <span className="card-chip-value">{card.damage}</span>
        </span>

        {/* 左下：格挡（盾牌；卡没有血量） */}
        <span className="card-chip card-chip--block" title="格挡">
          <svg className="card-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 5 L91 21 V51 C91 76 72 91 50 97 C28 91 9 76 9 51 V21 Z" />
          </svg>
          <span className="card-chip-value">{card.block}</span>
        </span>

        {/* 内框：立绘 / 名字 / 词条；三个角徽压住它的角 */}
        <div className="card-tile-inner">
          <span className="card-tile-art" aria-hidden="true" />

          <div className="card-tile-head">
            <span className="card-tile-name">{card.name}</span>
            {/* 来源：紧跟在牌名后的 pill（同参战者卡的「当前行动」），不是自己的牌用传递色。
                来源是角色名，显示走 `displayName`（剥掉 `角色.` 前缀）。 */}
            {showSource ? (
              <span
                className={
                  isForeignSource
                    ? "card-tile-name-state card-tile-name-state--foreign"
                    : "card-tile-name-state"
                }
                title={`来源：${displayName(card.source)}`}
              >
                来源：{displayName(card.source)}
              </span>
            ) : null}
            {claimed ? <span className="badge badge--claimed">已领取</span> : null}
          </div>

          {/* 词条区：目标 / 段数（pill）+ 词缀 / 布尔（带色 chip 按钮）。二者是同一套：
              每枚都可点——问它"是什么"（tooltip / 由调用方接管，见 `onMarkClick`）。 */}
          <div className="card-tile-marks">
            {readCardMarks(card).map((mark) => (
              <button
                key={mark.id}
                type="button"
                className={`affix-chip affix-chip--${mark.tone}`}
                aria-describedby={tip?.mark.id === mark.id ? tipId : undefined}
                onClick={(event) => handleMarkClick(mark, event.currentTarget)}
              >
                {mark.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {action ? <div className="card-actions">{action}</div> : null}
    </>
  );

  const tileClass = `card-tile${claimed ? " card-tile--claimed" : ""}${
    onSelect ? " card-tile--open" : ""
  }${selected ? " card-tile--selected" : ""}`;

  return (
    <li className={tileClass}>
      {content}
      {onSelect === undefined ? null : (
        <button
          type="button"
          className="card-tile-open"
          aria-label={selectAriaLabel ?? `查看卡牌：${card.name}`}
          onClick={() => onSelect(card)}
        />
      )}

      {/* 说明浮层挂在卡片里、用 fixed 定位：祖先的 `overflow` 裁不到它 */}
      {tip === null ? null : (
        <CardMarkTip id={tipId} mark={tip.mark} anchor={tip.anchor} onClose={() => setTip(null)} />
      )}
    </li>
  );
}
