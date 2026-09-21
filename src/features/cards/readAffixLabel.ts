/** 提取失败时保留的字符数（超出就截断，并补 `...`）。 */
export const AFFIX_LABEL_MAX = 10;

/**
 * 词缀的**紧凑标签**：`[名称]:触发倾向描述` 只保留 `[名称]`。
 *
 * 词缀是服务端 LLM 的自由文本（`Card.on_play_affixes` / `on_hit_affixes` /
 * `on_turn_end_affixes`），**格式可能不合法**。所以这里只认 `[名称]:` 这一个形状：
 * 半角/全角冒号都收，解析不出名称时**不猜**（不试着找分隔符、不编名字），直接把原文截断成
 * `前缀...`——完整原文留给「卡牌」详情浮窗显示。
 *
 * 返回值**带方括号**（能解析时）：紧凑卡面只搬这一个字符串，`[...]` 的写法只在这里定义一处。
 */
export function readAffixLabel(affix: string): string {
  const name = /^\[([^[\]]+)\]\s*[:：]/.exec(affix.trim())?.[1]?.trim();
  if (name !== undefined && name !== "") {
    return `[${name}]`;
  }
  return affix.length > AFFIX_LABEL_MAX ? `${affix.slice(0, AFFIX_LABEL_MAX)}...` : affix;
}
