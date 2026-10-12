import type { ReactNode } from "react";
import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import { characterStatsText } from "./characterStatsText";

/**
 * 竖置的角色卡（dungeon 内唯一实现，开场房与战斗开局共用）；与场景卡共用一副足迹、只是转 90°。
 *
 * 给 `onOpenInfo` 时整卡可点（铺一层透明按钮），卡底 `children` 抬在其上；`showAttackDefense`
 * 决定属性行是否带 attack / defense。卡片无状态，浮窗开关归调用方。
 */
export default function ActorCard({
  name,
  badge,
  stats,
  showAttackDefense = false,
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
  /** 属性行连 attack / defense 一起给（开局准备屏）；不给就只写 `hp x/y`。 */
  showAttackDefense?: boolean;
  /** 属性下的第二行（如「卡组 9」）；不给就不占行。 */
  extra?: string;
  /** 有则**整卡可点**（开角色信息浮窗）；没有就整卡不可点，名字是静态文本。 */
  onOpenInfo?: () => void;
  /** 卡底动作区（如奖励按钮）；不给就不渲染整个区域。 */
  children?: ReactNode;
}) {
  return (
    <article
      className={onOpenInfo === undefined ? "card actor-card" : "card actor-card actor-card--open"}
    >
      <div className="card-head">
        <span className="chip mono">{displayName(name)}</span>
        {badge === undefined ? null : <span className="badge">{badge}</span>}
      </div>

      <p className="muted actor-card-stats">
        <span>{characterStatsText(stats, showAttackDefense)}</span>
        {extra === undefined ? null : <span>{extra}</span>}
      </p>

      {children === undefined ? null : <div className="card-actions">{children}</div>}

      {/* 整卡可点的透明层；卡底动作按钮由 CSS 抬到它上面 */}
      {onOpenInfo === undefined ? null : (
        <button
          type="button"
          className="actor-card-open"
          aria-label={`查看角色：${displayName(name)}`}
          onClick={onOpenInfo}
        />
      )}
    </article>
  );
}
