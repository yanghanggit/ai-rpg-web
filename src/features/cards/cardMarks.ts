import { readAffixLabel, readAffixParts } from "./readAffixLabel";
import type { Card, CardTargetType } from "./types";

/** 目标类型 → 界面说法；**单体是默认，不标**（只有多目标才值得占一枚 pill）。 */
const TARGET_LABELS: Partial<Record<CardTargetType, string>> = {
  all: "全体",
  spread: "散射",
};

/**
 * 词条区里「目标 + 段数」合一的那枚 pill：`全体` / `散射` / `自身`（单体不写），
 * `hit_count > 1` 时后缀 `xN`。两者都为空（单段单体）就返回空串，卡面不渲染这一枚。
 */
function targetText(card: Card): string {
  const label = card.self_target ? "自身" : (TARGET_LABELS[card.target_type] ?? "");
  return `${label}${card.hit_count > 1 ? `x${card.hit_count}` : ""}`;
}

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
    hint: "打出时额外复制一份给目标；本体照常结算并进入弃牌/消耗流程。副本落地即失去传递性，不可再传递。",
    shown: (card) => card.transferable,
  },
];

/**
 * 卡面上的一个标记：chip 与说明共用同一份（卡面 / tooltip / 详情右栏）。
 * 「目标 + 段数」那枚 pill 也算一枚（`tone: "target"`），与词缀 / 布尔走同一套机制。
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

/** 目标 / 段数那枚 pill 的说明：先一句「打哪」，再一句「几段」（都没有就不出现）。 */
function readTargetMark(card: Card): CardMark | null {
  const label = targetText(card);
  if (label === "") {
    return null;
  }
  const where = card.self_target
    ? "以自己为目标。"
    : card.target_type === "all"
      ? "命中目标阵营里的所有人。"
      : card.target_type === "spread"
        ? "在目标阵营里随机命中。"
        : "";
  const hits = card.hit_count > 1 ? `这张牌会命中 ${card.hit_count} 次。` : "";
  return {
    id: "target",
    group: "目标",
    label,
    tone: "target",
    hint: `${where}${hits}`,
  };
}

/** 这张卡身上全部要显示的标记：目标 pill 在前，然后布尔，最后三种时机词缀（即卡面顺序）。 */
export function readCardMarks(card: Card): CardMark[] {
  const target = readTargetMark(card);

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

  return [...(target === null ? [] : [target]), ...flags, ...affixes];
}
