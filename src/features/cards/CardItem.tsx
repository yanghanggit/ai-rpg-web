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
 * 卡牌：**「一张卡长什么样」的唯一实现**，奖励（Spoils）候选、牌组、以后的手牌/弃牌堆都用它
 * （与 `ItemRow` 对道具是同一个理由：展示规则一旦分叉，同一张卡在两处就会长得不一样）。
 *
 * `action` 是给调用方放自己控件的插槽（例如奖励里的「挑选」）——动作属于流程，
 * 不属于卡牌本身，所以卡牌只提供位置，不替别的流程命名动词。
 *
 * 牌名直接显示：**卡牌名不带 `类型.` 前缀**（后端 `Card.name` 就是叙事化的牌名，
 * 原型见 `demo/card_prototypes.py`），所以不走 `displayName`（那会把名字里的 `.` 当分隔符切掉）。
 *
 * `claimed` 标记「这张卡已经被领走」：同一张卡在候选与已领取两处出现时，已领取的那份要能一眼
 * 认出来（加绿框 + 「已领取」徽标）。这是**卡牌状态**而不是流程动作，所以用布尔 prop 表达，
 * 而不是让调用方自己拼 class。
 *
 * `affixes` 是两种颗粒度：`full` 给完整原文（奖励 / 战斗手牌 / 卡牌详情），`names` 只给
 * `readAffixLabel` 出的 `[名称]`——牌组卡面要「一行三张、所有行等高」，长词缀会把卡撑高撑乱。
 *
 * `onSelect` 给了就把整张卡包成按钮（点击区域 = 整张卡），用于点开卡牌详情；没给就是纯展示。
 * 详情浮窗只是「同一张卡的另一种颗粒度」，所以回到这里渲染，不另写一份卡面。
 */
export default function CardItem({
  card,
  action,
  claimed = false,
  affixes = "full",
  onSelect,
  selected = false,
  selectAriaLabel,
}: {
  card: Card;
  action?: ReactNode;
  /** 该卡已被领取：加视觉标记（区别于仍在候选里的同款卡）。 */
  claimed?: boolean;
  /** 词缀颗粒度：`full` 完整原文，`names` 只留 `[名称]`。 */
  affixes?: "full" | "names";
  /** 给了就整张卡可点（回调拿卡本身，调用方决定开哪层浮窗）。 */
  onSelect?: (card: Card) => void;
  /** 该卡处于选中态（如战斗手牌被点选待出）：加绿框。 */
  selected?: boolean;
  /** 无障得名字；不给就用「查看卡牌：xxx」（`onSelect` 的默认语义）。 */
  selectAriaLabel?: string;
}) {
  const content = (
    <>
      <div className="card-tile-head">
        <span className="card-tile-name">{card.name}</span>
        {claimed ? <span className="badge badge--claimed">已领取</span> : null}
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
            <span className="chip">{label}</span>{" "}
            {affixes === "names"
              ? card[key].map((affix) => readAffixLabel(affix)).join(" ")
              : card[key].join("、")}
          </p>
        ),
      )}

      {card.source === "" ? null : <p className="muted card-tile-source">来源：{card.source}</p>}

      {action ? <div className="card-actions">{action}</div> : null}
    </>
  );

  const tileClass = `card-tile${claimed ? " card-tile--claimed" : ""}${
    onSelect ? " card-tile--open" : ""
  }${selected ? " card-tile--selected" : ""}`;

  return (
    <li className={tileClass}>
      {onSelect ? (
        <button
          type="button"
          className="card-tile-open"
          aria-label={selectAriaLabel ?? `查看卡牌：${card.name}`}
          onClick={() => onSelect(card)}
        >
          {content}
        </button>
      ) : (
        content
      )}
    </li>
  );
}
