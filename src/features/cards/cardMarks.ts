import { readAffixLabel, readAffixParts } from "./readAffixLabel";
import type { Card } from "./types";

/** 三种触发时机的词缀字段名。 */
export type AffixKey = "on_play_affixes" | "on_hit_affixes" | "on_turn_end_affixes";

/** 三种触发时机 → 中文标签 + 色调（绿 / 红 / 黄）。 */
export const AFFIX_TYPES: { key: AffixKey; label: string; tone: string }[] = [
  { key: "on_play_affixes", label: "打出时", tone: "play" },
  { key: "on_hit_affixes", label: "被命中时", tone: "hit" },
  { key: "on_turn_end_affixes", label: "回合结束时", tone: "turn-end" },
];

/** 布尔标记在卡面上的分类名（它们不是"某时机触发"，而是"这张牌身上要留意的一件事"）。 */
const FLAG_GROUP = "标记";

/**
 * 布尔标记：`hint` 是前端自带文案（后端只下发 `true/false`，说明写在字段注释里，后端改了机制要回来对齐）。
 * 极性逐项写死：`playable` 是 `false` 才标，其余四个是 `true` 才标。
 */
const FLAG_SPECS: {
  key: string;
  label: string;
  tone: string;
  hint: string;
  shown: (card: Card) => boolean;
}[] = [
  {
    key: "playable",
    label: "不可出牌",
    tone: "unplayable",
    hint: "系统会拦住这张牌：不能主动打出。",
    shown: (card) => !card.playable,
  },
  {
    key: "exhaust",
    label: "消耗牌",
    tone: "exhaust",
    hint: "打出后永久归入消耗牌堆，不会再进弃牌循环。",
    shown: (card) => card.exhaust,
  },
  {
    key: "retain",
    label: "保留",
    tone: "retain",
    hint: "回合结束时留在手牌，不进入弃牌堆。",
    shown: (card) => card.retain,
  },
  {
    key: "ethereal",
    label: "虚无",
    tone: "ethereal",
    hint: "过牌时若还留在手牌，自动归入消耗牌堆。",
    shown: (card) => card.ethereal,
  },
  {
    key: "transferable",
    label: "可传递",
    tone: "transfer",
    hint: "打出时复制一份给目标，本体留在自己手牌。",
    shown: (card) => card.transferable,
  },
];

/**
 * 卡面上的一个标记：chip 与说明共用同一份（卡面 / tooltip / 详情右栏）。
 * `hit_count` 不是标记——它在数值行。
 */
export interface CardMark {
  /** 稳定标识：卡面与详情右栏算出来必须一致，详情据此定位高亮。 */
  id: string;
  /** 分类标签：`标记`（布尔）/ `打出时` / `被命中时` / `回合结束时`。 */
  group: string;
  /** chip 上的文字：`保留` / `[楔入]`（解析不出名称的词缀是截断后的原文）。 */
  label: string;
  /** chip 的色调：对应 `index.css` 的 `.affix-chip--<tone>`。 */
  tone: string;
  /** 一句话说明：tooltip 与详情右栏共用同一份。 */
  hint: string;
}

/** 这张卡身上全部要显示的标记：布尔在前、三种时机词缀在后（即卡面顺序）。 */
export function readCardMarks(card: Card): CardMark[] {
  const flags: CardMark[] = FLAG_SPECS.filter((spec) => spec.shown(card)).map((spec) => ({
    id: `flag:${spec.key}`,
    group: FLAG_GROUP,
    label: spec.label,
    tone: spec.tone,
    hint: spec.hint,
  }));

  const affixes: CardMark[] = AFFIX_TYPES.flatMap(({ key, label, tone }) =>
    card[key].map((affix) => {
      const { detail } = readAffixParts(affix);
      return {
        id: `${key}:${affix}`,
        group: label,
        label: readAffixLabel(affix),
        tone,
        // 名称解析不出来时不硬编一个：整条原文就是说明，`[名称]` 那枚 chip 也就不出现
        hint: detail,
      };
    }),
  );

  return [...flags, ...affixes];
}
