/**
 * 角色卡的两个下角数值：左下**盾**（总格挡）、右下**心**（HP），与 `.combatant-chip*` 的定位配套。
 *
 * 战斗名单的参战者卡与 dungeon 的 `ActorCard` **共用同一份**——别在别处再画一遍。
 */
const CHIP_SHAPES = {
  block: "M50 5 L91 21 V51 C91 76 72 91 50 97 C28 91 9 76 9 51 V21 Z",
  hp: "M50 90 C20 68 7 51 7 35 C7 20 18 9 32 9 C41 9 47 14 50 20 C53 14 59 9 68 9 C82 9 93 20 93 35 C93 51 80 68 50 90 Z",
} as const;

export default function ActorChip({
  kind,
  value,
  title,
}: {
  /** `block` → 左下盾；`hp` → 右下心。 */
  kind: "block" | "hp";
  /** 徽上的数字（HP 只写当前值；读不到属性时给 `—`）。 */
  value: number | string;
  /** 悬停说明（HP 的全长 `x/y` 补在这里）。 */
  title: string;
}) {
  return (
    <span className={`combatant-chip combatant-chip--${kind}`} title={title}>
      <svg className="combatant-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
        <path d={CHIP_SHAPES[kind]} />
      </svg>
      <span className="combatant-chip-value">{value}</span>
    </span>
  );
}
