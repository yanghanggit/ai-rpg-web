/** 词缀形状 `[名称]:说明`（半角 / 全角冒号都收，两侧空白可有可无）。 */
const AFFIX_PATTERN = /^\[([^[\]]+)\]\s*[:：]\s*([\s\S]*)$/;

/** 提取失败时保留的字符数（超出就截断，并补 `...`）。 */
export const AFFIX_LABEL_MAX = 10;

/** 拆成 `[名称]` 与说明两段；解析不出名称时 `name` 为 `null`、`detail` 是原文。 */
export function readAffixParts(affix: string): { name: string | null; detail: string } {
  const match = AFFIX_PATTERN.exec(affix.trim());
  const name = match?.[1]?.trim();
  if (match === null || name === undefined || name === "") {
    return { name: null, detail: affix };
  }
  // 捕获组 2 一定参与匹配，`?? ""` 只是给类型看的
  return { name, detail: (match[2] ?? "").trim() };
}

/**
 * 词缀的紧凑标签：只保留 `[名称]`（带方括号）；解析不出名称就截断原文，完整原文留给卡牌详情。
 */
export function readAffixLabel(affix: string): string {
  const { name } = readAffixParts(affix);
  if (name !== null) {
    return `[${name}]`;
  }
  return affix.length > AFFIX_LABEL_MAX ? `${affix.slice(0, AFFIX_LABEL_MAX)}...` : affix;
}
