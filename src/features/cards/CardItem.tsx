import { type ReactNode, useId, useState } from "react";
import CardMarkTip from "./CardMarkTip";
import type { CardMark } from "./cardMarks";
import { readCardMarks } from "./cardMarks";
import type { Card, CardTargetType } from "./types";

/**
 * 卡牌 · 客户端设计语言（唯一实现）
 *
 * 后端 `models/card.py::Card` 的字段分三类，卡面据此分三块，**同类用同一种视觉**：
 * - **身份**：`name`（卡名）/ `uuid`；`source` 单独一行。
 *   **叙述 `description` 不进卡面**：卡面上留给数值与标记，全文在卡牌详情（`CardDetailDialog`）
 *   的「说明」一节里读——牌面上那句话只够塞下两行，读起来又占掉半张卡。
 * - **数值**：`cost` / `damage` / `hit_count` / `block` / `target_type` / `self_target` → 一行 `statsText`。
 * - **标记（词缀）** → 一律是 chip（`.affix-chip`），排在同一行 `.card-tile-marks`：
 *   三种时机的自由文本词缀（绿 / 红 / 黄）与五个布尔属性（橙 / 蓝 / 紫 / 灰 / 青）。
 *   两者在 `cardMarks.ts` 里合成同一个 `CardMark` 形状，所以**卡面、tooltip、详情右栏
 *   用的是同一份列表**——不会出现"某一处漏了一枚"。
 *
 * **点标记 = 问"这是什么"**（`onMarkClick` 不给时）：弹一枚 `CardMarkTip` 说明它。
 * 布尔与时机词缀行为完全一致——以前只有时机词缀可点、布尔没反应，是不统一的来源。
 *
 * **`transferable` 是"牌属性"，`【塞牌】` 是"牌与持有者的关系"**：后者不进卡面（此时主体就是这张卡），
 * 只挂在 ActorCard 一侧。`source` 只在"不是持有者的牌"时才显示，且用 `--transfer` 色强调。
 */

/** 目标类型 → 界面说法；`self_target` 的卡不看这个（统一显示「自身」）。 */
const TARGET_LABELS: Record<CardTargetType, string> = {
  single: "单体",
  all: "阵营全体",
  spread: "阵营散射",
};

/** 数值行：`费用 1 · 伤害 3 ×2 · 格挡 0 · 目标 单体`（连击只在多段时出现）。 */
function statsText(card: Card): string {
  const parts = [
    `费用 ${card.cost}`,
    card.hit_count > 1 ? `伤害 ${card.damage} ×${card.hit_count}` : `伤害 ${card.damage}`,
    `格挡 ${card.block}`,
    `目标 ${card.self_target ? "自身" : TARGET_LABELS[card.target_type]}`,
  ];
  return parts.join(" · ");
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
      <div className="card-tile-head">
        <span className="card-tile-name">{card.name}</span>
        {claimed ? <span className="badge badge--claimed">已领取</span> : null}
      </div>

      <p className="muted card-tile-stats">{statsText(card)}</p>

      {/* 标记行：布尔属性 + 三种时机的词缀，统一 chip；抬到「整卡可点」那层之上。
          每一枚都可点——问它"是什么"（或由调用方接管，见 `onMarkClick`）。 */}
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
