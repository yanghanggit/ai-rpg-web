import type { ReactNode } from "react";

/**
 * 角色卡的角徽：左上**能量**（圆，与手牌的费用同一枚）、左下**盾**（总格挡）、右下**心**（HP）。
 *
 * 战斗名单的参战者卡三枚都用；dungeon 的 `ActorCard`（进房 / 结算）只用 HP 那枚——那两屏
 * 还没有「这回合能花多少」这回事。
 */
const CHIP_SHAPES: Record<"energy" | "block" | "hp", ReactNode> = {
  // 圆：能量与卡牌费用共用（都是"这一手要花多少"）
  energy: <circle cx="50" cy="50" r="48" />,
  block: <path d="M50 5 L91 21 V51 C91 76 72 91 50 97 C28 91 9 76 9 51 V21 Z" />,
  hp: (
    <path d="M50 90 C20 68 7 51 7 35 C7 20 18 9 32 9 C41 9 47 14 50 20 C53 14 59 9 68 9 C82 9 93 20 93 35 C93 51 80 68 50 90 Z" />
  ),
};

export default function ActorChip({
  kind,
  value,
  title,
}: {
  /** `energy` → 左上圆；`block` → 左下盾；`hp` → 右下心。 */
  kind: "energy" | "block" | "hp";
  /** 徽上的数字（HP 只写当前值；读不到属性时给 `—`）。 */
  value: number | string;
  /** 悬停说明（HP 的全长 `x/y` 补在这里）。 */
  title: string;
}) {
  return (
    <span className={`combatant-chip combatant-chip--${kind}`} title={title}>
      <svg className="combatant-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
        {CHIP_SHAPES[kind]}
      </svg>
      <span className="combatant-chip-value">{value}</span>
    </span>
  );
}
