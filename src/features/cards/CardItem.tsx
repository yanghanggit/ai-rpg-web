import type { ReactNode } from "react";
import { readAffixLabel } from "./readAffixLabel";
import type { Card, CardTargetType } from "./types";

/**
 * 卡牌 · 客户端设计语言（唯一实现）
 *
 * 后端 `models/card.py::Card` 的字段分三类，卡面据此分三块，**同类用同一种视觉**：
 * - **身份**：`name`（卡名）/ `description`（叙述）/ `uuid`；`source` 单独一行。
 * - **数值**：`cost` / `damage` / `hit_count` / `block` / `target_type` / `self_target` → 一行 `statsText`。
 * - **标记（当作\"词缀\"看的那一类）** → 一律是 chip（`.affix-chip`），排在同一行 `.card-tile-marks`：
 *   - 三种时机的自由文本词缀 `on_play_affixes` / `on_hit_affixes` / `on_turn_end_affixes`
 *     （绿 / 红 / 黄；卡面只写 `[名称]`，点开看全文）；
 *   - 布尔属性 `exhaust`（消耗牌）/ `retain`（保留）/ `ethereal`（虚无）/ `playable`（不可出牌）/
 *     `transferable`（可传递）——与三种时机一样**各配一色**（橙 / 蓝 / 紫 / 灰 / 青），
 *     视觉上就是同一排带色 chip。
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

/** 三种触发时机的词缀。 */
type AffixKey = "on_play_affixes" | "on_hit_affixes" | "on_turn_end_affixes";

/** 三种触发时机 → 中文标签 + 色调（绿 / 红 / 黄）。 */
const AFFIX_TYPES: { key: AffixKey; label: string; tone: string }[] = [
  { key: "on_play_affixes", label: "打出时", tone: "play" },
  { key: "on_hit_affixes", label: "被命中时", tone: "hit" },
  { key: "on_turn_end_affixes", label: "回合结束时", tone: "turn-end" },
];

/**
 * 卡面的布尔标记（当作词缀看的那一类）：与三种时机一样都带颜色 —— 消耗牌（橙）/ 保留（蓝）/
 * 虚无（紫）/ 可传递（青）/ 不可出牌（灰）。
 *
 * 极性是**逐项写死**的，不是因为啰嗦：`playable` 是「false 才标」，其余是「true 才标」，
 * 用一个「布尔 → 标签」的表会把这个差异藏起来。
 */
function flagLabels(card: Card): { label: string; tone: string }[] {
  return [
    !card.playable ? { label: "不可出牌", tone: "unplayable" } : null,
    card.exhaust ? { label: "消耗牌", tone: "exhaust" } : null,
    card.retain ? { label: "保留", tone: "retain" } : null,
    card.ethereal ? { label: "虚无", tone: "ethereal" } : null,
    card.transferable ? { label: "可传递", tone: "transfer" } : null,
  ].filter((entry): entry is { label: string; tone: string } => entry !== null);
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
 * **词缀两种颗粒度**：卡面（`names`）把词缀渲染成一枚**按钮/标记**，只写 `[名称]`，三种时机用颜色区分；
 * 点它（`onAffixClick`，或回退到 `onSelect`）叠出**卡牌详情**看完整原文——详情（`full`）才把全文写一遍。
 *
 * `onSelect` 给了就**整张卡可点**（铺一层透明按钮，见 `.card-tile-open`）；标记按钮抬在它之上。
 *
 * **来源显示口径**：`hideSource` 一律不显示（牌组）；`owner` 只在 `source !== owner` 时才显示，
 * 并用 `--transfer` 色强调"不是自己的牌"。
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
  /** 一律不显示来源（牌组）。 */
  hideSource?: boolean;
  /** 持有者原始名：`source` 与它相同就不显示来源。 */
  owner?: string;
}) {
  const openDetail = onAffixClick ?? onSelect;
  const isForeignSource = card.source !== "" && owner !== undefined && card.source !== owner;
  const showSource =
    !hideSource && card.source !== "" && (owner === undefined || card.source !== owner);

  const content = (
    <>
      <div className="card-tile-head">
        <span className="card-tile-name">{card.name}</span>
        {claimed ? <span className="badge badge--claimed">已领取</span> : null}
      </div>

      {card.description === "" ? null : <p className="card-tile-desc">{card.description}</p>}

      <p className="muted card-tile-stats">{statsText(card)}</p>

      {/* 标记行：布尔属性 + 三种时机的词缀，统一 chip；`names` 时都在这里，`full` 的词缀另起段 */}
      <div className="card-tile-marks">
        {flagLabels(card).map(({ label, tone }) => (
          <span key={label} className={`affix-chip affix-chip--${tone}`}>
            {label}
          </span>
        ))}
        {affixes === "names"
          ? AFFIX_TYPES.flatMap(({ key, label, tone }) =>
              card[key].map((affix) =>
                openDetail === undefined ? (
                  <span
                    key={`${key}-${affix}`}
                    className={`affix-chip affix-chip--${tone}`}
                    title={label}
                  >
                    {readAffixLabel(affix)}
                  </span>
                ) : (
                  <button
                    key={`${key}-${affix}`}
                    type="button"
                    className={`affix-chip affix-chip--${tone}`}
                    title={`${label}（点开看完整词缀）`}
                    onClick={() => openDetail(card)}
                  >
                    {readAffixLabel(affix)}
                  </button>
                ),
              ),
            )
          : null}
      </div>

      {affixes === "full"
        ? AFFIX_TYPES.map(({ key, label, tone }) =>
            card[key].length === 0 ? null : (
              <p key={key} className="card-tile-affixes">
                <span className={`affix-mark affix-mark--${tone}`}>{label}</span>{" "}
                {card[key].join("、")}
              </p>
            ),
          )
        : null}

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
    </li>
  );
}
