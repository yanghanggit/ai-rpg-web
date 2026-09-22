/**
 * 卡牌领域的共享类型。
 *
 * 后端没有把 `Card` 暴露进 OpenAPI（`ComponentSerialization.data` 是 `Dict[str, Any]`），
 * 所以这里写不出契约类型——取值必须与 `ai-rpg` 的 `models/card.py::Card` 与
 * `models/target_type.py::TargetType` 保持一致，靠 `readCard` 的运行时校验兜住。
 */

/** 目标类型判别值，与后端 `TargetType` 的字符串值一一对应。 */
export const TARGET_TYPES = ["single", "all", "spread"] as const;

export type CardTargetType = (typeof TARGET_TYPES)[number];

/**
 * 校验后的卡牌：字段名与后端一致（保留 snake_case，见 docs/conventions.md 四），
 * `target_type` 已收窄到已知三种。
 */
export interface Card {
  name: string;
  /** 全局唯一标识；同名卡靠它区分（React key 也用它）。 */
  uuid: string;
  /** 叙事锚点：不含数值，不重述其它字段已确定的效果。 */
  description: string;
  /** 来源（生成/注入者）名称；空字符串表示来源未知。 */
  source: string;
  cost: number;
  damage: number;
  hit_count: number;
  block: number;
  target_type: CardTargetType;
  /** 锁定自身；true 时目标即自己，忽略 `target_type`。 */
  self_target: boolean;
  /** 三种触发时机的词缀（自由文本，格式 `[名称]:触发倾向描述`）。 */
  on_play_affixes: string[];
  on_hit_affixes: string[];
  on_turn_end_affixes: string[];
  /** 出牌后永久消耗。 */
  exhaust: boolean;
  /** 回合末保留在手牌。 */
  retain: boolean;
  /** pass turn 时若仍在手牌则自动消耗。 */
  ethereal: boolean;
  /** 出牌时把本体 copy 到每个目标手牌（即【塞牌】的机制）。 */
  transferable: boolean;
  /** 是否可出牌；false 时系统阻止出牌。 */
  playable: boolean;
}
