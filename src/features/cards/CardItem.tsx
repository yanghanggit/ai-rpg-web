import type { ReactNode } from "react";
import { readAffixLabel } from "./readAffixLabel";
import type { Card, CardTargetType } from "./types";

/** 目标类型 → 界面说法；`self_target` 的卡不看这个（统一显示「自身」）。 */
const TARGET_LABELS: Record<CardTargetType, string> = {
  single: "单体",
  all: "阵营全体",
  spread: "阵营散射",
};

/** 三种触发时机的词缀。 */
type AffixKey = "on_play_affixes" | "on_hit_affixes" | "on_turn_end_affixes";

/**
 * 三种触发时机 → 中文标签 + 色调。卡面（`affixes="names"`）只给**标记**，靠颜色区分三种时机：
 * 打出时（绿）/ 被命中时（红）/ 回合结束时（黄）。完整原文只在卡牌详情（`affixes="full"`）里出现。
 */
const AFFIX_TYPES: { key: AffixKey; label: string; tone: string }[] = [
  { key: "on_play_affixes", label: "打出时", tone: "play" },
  { key: "on_hit_affixes", label: "被命中时", tone: "hit" },
  { key: "on_turn_end_affixes", label: "回合结束时", tone: "turn-end" },
];

/**
 * 卡面标记。
 *
 * 极性是**逐项写死**的，不是因为啰嗦：`playable` 是「false 才标」，其余是「true 才标」，
 * 用一个「布尔 → 标签」的表会把这个差异藏起来。`transferable` 带色调（见 `.badge--transfer`）。
 */
function flagLabels(card: Card): { label: string; tone?: string }[] {
  return [
    !card.playable ? { label: "不可出牌" } : null,
    card.exhaust ? { label: "消耗牌" } : null,
    card.retain ? { label: "保留" } : null,
    card.ethereal ? { label: "虚无" } : null,
    card.transferable ? { label: "可传递", tone: "transfer" } : null,
  ].filter((entry): entry is { label: string; tone?: string } => entry !== null);
}

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
 * **词缀两种颗粒度**：卡面（`names`）把每个词缀渲染成一枚**按钮/标记**，只写 `[名称]`（表达"有"），
 * 三种时机用颜色区分；点它（`onAffixClick`，或回退到 `onSelect`）叠出**卡牌详情**看完整原文——
 * 详情（`full`）才把每个词缀的全文各写一遍。这样长词缀不会把卡面撑坏，也不用两套卡面。
 *
 * `onSelect` 给了就**整张卡可点**（铺一层透明按钮，见 `.card-tile-open`）；词缀按钮抬在它之上，
 * 自己收下自己的点击。不给就整卡不可点。
 *
 * **来源显示口径**（`source` 是卡牌的生成/注入者）：
 * - `hideSource`：牌组里一律不显示（牌必属持有者）；
 * - 给了 `owner`：只在 `source !== owner`（不是自己的牌，如【塞牌】）时才显示，否则是多余的。
 */
export default function CardItem({
  card,
  action,
  claimed = false,
  affixes = "full",
  onSelect,
  onAffixClick,
  selected = false,
  selectAriaLabel,
  badge,
  hideSource = false,
  owner,
}: {
  card: Card;
  action?: ReactNode;
  /** 该卡已被领取：加视觉标记（区别于仍在候选里的同款卡）。 */
  claimed?: boolean;
  /** 词缀颗粒度：`full` 完整原文（详情），`names` 只留 `[名称]` 标记（卡面）。 */
  affixes?: "full" | "names";
  /** 给了就整张卡可点（回调拿卡本身，调用方决定开哪层浮窗）。 */
  onSelect?: (card: Card) => void;
  /** 点某个词缀 → 开卡牌详情；不给就回退到 `onSelect`，都没有就只是静态标记。 */
  onAffixClick?: (card: Card) => void;
  /** 该卡处于选中态（如战斗手牌被点选待出）：加绿框。 */
  selected?: boolean;
  /** 无障碍名字；不给就用「查看卡牌：xxx」（`onSelect` 的默认语义）。 */
  selectAriaLabel?: string;
  /** 调用方额外要挂在卡头的一枚标记（如敌方手牌里来自我方的【塞牌】）。 */
  badge?: ReactNode;
  /** 一律不显示来源（牌组）。 */
  hideSource?: boolean;
  /** 持有者原始名：`source` 与它相同就不显示来源。 */
  owner?: string;
}) {
  const openDetail = onAffixClick ?? onSelect;
  const showSource =
    !hideSource && card.source !== "" && (owner === undefined || card.source !== owner);

  const content = (
    <>
      <div className="card-tile-head">
        <span className="card-tile-name">{card.name}</span>
        {claimed ? <span className="badge badge--claimed">已领取</span> : null}
        {badge}
        {flagLabels(card).map(({ label, tone }) => (
          <span key={label} className={tone === undefined ? "badge" : `badge badge--${tone}`}>
            {label}
          </span>
        ))}
      </div>

      {card.description === "" ? null : <p className="card-tile-desc">{card.description}</p>}

      <p className="muted card-tile-stats">{statsText(card)}</p>

      {AFFIX_TYPES.map(({ key: affixKey, label, tone }) =>
        card[affixKey].length === 0 ? null : (
          <p key={affixKey} className="card-tile-affixes">
            {affixes === "full" ? (
              <>
                <span className={`affix-mark affix-mark--${tone}`}>{label}</span>{" "}
                {card[affixKey].join("、")}
              </>
            ) : (
              card[affixKey].map((affix) =>
                openDetail === undefined ? (
                  <span key={affix} className={`affix-chip affix-chip--${tone}`} title={label}>
                    {readAffixLabel(affix)}
                  </span>
                ) : (
                  <button
                    key={affix}
                    type="button"
                    className={`affix-chip affix-chip--${tone}`}
                    title={`${label}（点开看完整词缀）`}
                    onClick={() => openDetail(card)}
                  >
                    {readAffixLabel(affix)}
                  </button>
                ),
              )
            )}
          </p>
        ),
      )}

      {showSource ? <p className="muted card-tile-source">来源：{card.source}</p> : null}

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
    </li>
  );
}
