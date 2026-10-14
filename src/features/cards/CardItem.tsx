import { type ReactNode, useId, useState } from "react";
import CardMarkTip from "./CardMarkTip";
import type { CardMark } from "./cardMarks";
import { readCardMarks } from "./cardMarks";
import type { Card, CardTargetType } from "./types";

/**
 * 卡牌 · 客户端设计语言（唯一实现）。
 *
 * 牌面与参战者卡（`.combatant-card`）同一套「外框 + 内框 + 角落数值」语言：
 * - 左上角：**费用**（圆徽）；左下角：**伤害**（六角）；右下角：**格挡**（盾）。三个角徽**压住内框**。
 * - 内框自上而下：**立绘区**（先空着）→ 名字横幅 → 词条区（目标 / 段数 pill + 三种时机词缀与布尔属性）。
 * - 目标与段数**合成一枚 pill**：`全体` / `散射` / `自身`（单体是默认，不标），多段时后缀 `xN`；
 *   单段单体则不出现。词缀 / 布尔是**带色 chip 按钮**，点它弹 `CardMarkTip`（`onMarkClick`
 *   不给时）。`description` 不进卡面（全文在 `CardDetailDialog`）；`【塞牌】` 只挂在角色卡一侧。
 *
 * 手牌没有 `hp` 之说，所以右下角放的是**格挡**而不是血量。
 */

/** 目标类型 → 界面说法；**单体是默认，不标**（只有多目标才值得占一枚 pill）。 */
const TARGET_LABELS: Partial<Record<CardTargetType, string>> = {
  all: "全体",
  spread: "散射",
};

/**
 * 词条区里「目标 + 段数」合一的那枚 pill：`全体` / `散射` / `自身`（单体不写），
 * `hit_count > 1` 时后缀 `xN`。两者都为空（单段单体）就返回空串，调用方不渲染这一枚。
 */
function targetText(card: Card): string {
  const label = card.self_target ? "自身" : (TARGET_LABELS[card.target_type] ?? "");
  return `${label}${card.hit_count > 1 ? `x${card.hit_count}` : ""}`;
}

/**
 * 卡牌：**「一张卡长什么样」的唯一实现**，奖励（Spoils）候选、牌组、战斗手牌都用它
 * （与 `ItemRow` 对道具是同一个理由：展示规则一旦分叉，同一张卡在两处就会长得不一样）。
 *
 * `action` 是给调用方放自己控件的插槽（例如奖励里的「挑选」）——动作属于流程，
 * 不属于卡牌本身，所以卡牌只提供位置，不替别的流程命名动词。
 *
 * 牌名直接显示：**卡牌名不带 `类型.` 前缀**（后端 `Card.name` 就是叙事化的牌名，
 * 原型见 `demo/card_prototypes.py`），所以不走 `displayName`（那会把名字里的 `.` 当分隔符切掉）。
 *
 * `onSelect` 给了就**整张卡可点**（铺一层透明按钮，见 `.card-tile-open`）；标记 chip 抬在它之上。
 * **整卡点击的含义由调用方定**：战斗手牌里是"选中待出"，牌组 / 奖励里是"打开卡牌详情"。
 *
 * **来源显示口径**：`hideSource` 一律不显示（牌组）；`owner` 只在 `source !== owner` 时才显示，
 * 并用 `--transfer` 色强调"不是自己的牌"。
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

        {/* 左下：伤害 */}
        <span className="card-chip card-chip--damage" title="伤害">
          <svg className="card-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
            <polygon points="50 3 93 26 93 74 50 97 7 74 7 26" />
          </svg>
          <span className="card-chip-value">{card.damage}</span>
        </span>

        {/* 右下：格挡（盾牌；卡没有血量） */}
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
            {claimed ? <span className="badge badge--claimed">已领取</span> : null}
          </div>

          {/* 词条区：目标 / 段数（pill）+ 词缀 / 布尔（带色 chip 按钮）。
              每一枚词缀都可点——问它"是什么"（或由调用方接管，见 `onMarkClick`）。 */}
          <div className="card-tile-marks">
            {targetText(card) === "" ? null : (
              <span className="affix-chip affix-chip--target">{targetText(card)}</span>
            )}
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

          {showSource ? (
            <p
              className={
                isForeignSource
                  ? "card-tile-source card-tile-source--foreign"
                  : "muted card-tile-source"
              }
            >
              来源：{card.source}
            </p>
          ) : null}
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
