/**
 * 词缀的形状：`[名称]:说明`——半角 / 全角冒号都收，两侧空白可有可无。
 *
 * 只认这一个形状：词缀是服务端 LLM 的自由文本，格式可能不合法，所以**不猜**
 * （不试着找别的分隔符、不编名字）。半角 / 全角冒号用同一个字符类，避免两处各写一遍。
 */
const AFFIX_PATTERN = /^\[([^[\]]+)\]\s*[:：]\s*([\s\S]*)$/;

/** 提取失败时保留的字符数（超出就截断，并补 `...`）。 */
export const AFFIX_LABEL_MAX = 10;

/**
 * 把一条词缀拆成 **`[名称]` 与「:」后面的说明**两段。
 *
 * 解析不出名称时（格式不合法 / 名称是空的）`name` 给 `null`、`detail` 是**原文**——
 * 调用方据此决定"没有名称前缀时怎么排"，而不是在这里编一个名字出来。
 */
export function readAffixParts(affix: string): { name: string | null; detail: string } {
  const match = AFFIX_PATTERN.exec(affix.trim());
  const name = match?.[1]?.trim();
  if (match === null || name === undefined || name === "") {
    return { name: null, detail: affix };
  }
  // 捕获组 2 一定参与匹配（值为字符串或空串），`?? ""` 只是给类型看的
  return { name, detail: (match[2] ?? "").trim() };
}

/**
 * 词缀的**紧凑标签**：`[名称]:触发倾向描述` 只保留 `[名称]`。
 *
 * 解析不出名称时**不猜**（不试着找分隔符、不编名字），直接把原文截断成 `前缀...`
 * ——完整原文留给「卡牌」详情浮窗显示（`readAffixParts` + `CardDetailDialog`）。
 *
 * 返回值**带方括号**（能解析时）：紧凑卡面只搬这一个字符串，`[...]` 的写法只在这里定义一处。
 */
export function readAffixLabel(affix: string): string {
  const { name } = readAffixParts(affix);
  if (name !== null) {
    return `[${name}]`;
  }
  return affix.length > AFFIX_LABEL_MAX ? `${affix.slice(0, AFFIX_LABEL_MAX)}...` : affix;
}
