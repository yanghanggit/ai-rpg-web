import type { ReactNode } from "react";
import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import { characterStatsText } from "./characterStatsText";

/**
 * 竖置的**角色卡**（dungeon 内唯一实现，开场房与战斗开局共用）。
 *
 * 尺寸与场景卡（`StageCard`）共用同一副足迹（`--card-short` / `--card-tall`）：角色卡是
 * `短 × 长`（竖），场景卡是 `长 × 短`（横）——两者就是同一张卡转 90°，所以横竖并排时是一族
 * （见 `docs/pages.md`）。
 *
 * 卡片只长四样东西：
 * - **名字**（`chip`）：给 `onOpenInfo` 时是可点按钮（开角色信息浮窗），不给就是静态文本
 *   （战斗里的敌人不是可操作对象，不给入口）；
 * - **身份徽标**（玩家 / 怪物）：`badge`，不给就不占位；
 * - **属性一行**（`characterStatsText`，措辞的唯一来源）+ 可选的**第二行**（`extra`，如
 *   「卡组 N」）；
 * - **卡底动作区**（`children`）：开场房放奖励按钮，战斗开局没有动作就不渲染整个区域。
 *
 * 卡片本身**无状态**：角色信息 / 奖励等浮窗的开关都归调用方（面板层）持有——同一张卡在两种
 * 场景里只是"长没长那颗按钮"的差别，不该各自记住一套浮窗状态。
 */
export default function ActorCard({
  name,
  badge,
  stats,
  extra,
  onOpenInfo,
  children,
}: {
  /** 角色原始名（显示名交给 `displayName`）。 */
  name: string;
  /** 身份徽标（玩家 / 怪物）；不给就不显示。 */
  badge?: string;
  /** 角色属性（原始 `CharacterStats`，文案由 `characterStatsText` 统一生成）。 */
  stats: Schemas["CharacterStats"] | null;
  /** 属性下的第二行（如「卡组 9」）；不给就不占行。 */
  extra?: string;
  /** 有则名字可点（开角色信息浮窗）；没有就是静态 chip。 */
  onOpenInfo?: () => void;
  /** 卡底动作区（如奖励按钮）；不给就不渲染整个区域。 */
  children?: ReactNode;
}) {
  return (
    <article className="card actor-card">
      <div className="card-head">
        {onOpenInfo === undefined ? (
          <span className="chip mono">{displayName(name)}</span>
        ) : (
          <button type="button" className="chip chip-button mono" onClick={onOpenInfo}>
            {displayName(name)}
          </button>
        )}
        {badge === undefined ? null : <span className="badge">{badge}</span>}
      </div>

      <p className="muted actor-card-stats">
        <span>{characterStatsText(stats)}</span>
        {extra === undefined ? null : <span>{extra}</span>}
      </p>

      {children === undefined ? null : <div className="card-actions">{children}</div>}
    </article>
  );
}
