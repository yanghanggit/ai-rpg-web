import type { ReactNode } from "react";
import type { Card, CardTargetType } from "./types";

/** 目标类型 → 界面说法；`self_target` 的卡不看这个（统一显示「自身」）。 */
const TARGET_LABELS: Record<CardTargetType, string> = {
  single: "单体",
  all: "阵营全体",
  spread: "阵营散射",
};

/** 三种触发时机的词缀。 */
type AffixKey = "on_play_affixes" | "on_hit_affixes" | "on_turn_end_affixes";

const AFFIX_LABELS: [AffixKey, string][] = [
  ["on_play_affixes", "打出时"],
  ["on_hit_affixes", "被命中时"],
  ["on_turn_end_affixes", "回合结束时"],
];

/**
 * 卡面标记。
 *
 * 极性是**逐项写死**的，不是因为啰嗦：`playable` 是「false 才标」，其余三个是「true 才标」，
 * 用一个「布尔 → 标签」的表会把这个差异藏起来。
 */
function flagLabels(card: Card): string[] {
  return [
    !card.playable ? "不可出牌" : null,
    card.exhaust ? "消耗牌" : null,
    card.retain ? "保留" : null,
    card.ethereal ? "虚无" : null,
  ].filter((label): label is string => label !== null);
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
 * 卡牌：**「一张卡长什么样」的唯一实现**，卡池候选、牌组、以后的手牌/弃牌堆都用它
 * （与 `ItemRow` 对道具是同一个理由：展示规则一旦分叉，同一张卡在两处就会长得不一样）。
 *
 * `action` 是给调用方放自己控件的插槽（例如卡池里的「挑选」）——动作属于流程，
 * 不属于卡牌本身，所以卡牌只提供位置，不替别的流程命名动词。
 *
 * 牌名直接显示：**卡牌名不带 `类型.` 前缀**（后端 `Card.name` 就是叙事化的牌名，
 * 原型见 `demo/card_prototypes.py`），所以不走 `displayName`（那会把名字里的 `.` 当分隔符切掉）。
 */
export default function CardItem({ card, action }: { card: Card; action?: ReactNode }) {
  return (
    <li className="card-tile">
      <div className="card-tile-head">
        <span className="card-tile-name">{card.name}</span>
        {flagLabels(card).map((label) => (
          <span key={label} className="badge">
            {label}
          </span>
        ))}
      </div>

      {card.description === "" ? null : <p className="card-tile-desc">{card.description}</p>}

      <p className="muted card-tile-stats">{statsText(card)}</p>

      {AFFIX_LABELS.map(([key, label]) =>
        card[key].length === 0 ? null : (
          <p key={label} className="card-tile-affixes">
            <span className="chip">{label}</span> {card[key].join("、")}
          </p>
        ),
      )}

      {card.source === "" ? null : <p className="muted card-tile-source">来源：{card.source}</p>}

      {action ? <div className="card-actions">{action}</div> : null}
    </li>
  );
}
