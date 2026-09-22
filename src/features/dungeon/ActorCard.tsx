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
 * **交互与场景卡统一：整卡可点。** 给 `onOpenInfo` 时，卡面上铺一层透明按钮，点卡片任何地方
 * （含内边距）都开角色信息浮窗——名字不再是独立的小按钮（那会让人以为只有名字能点）。卡底的
 * **动作按钮（`children`）抬在这层之上**，自己的点击自己收下，不会顺带开出角色信息。不给
 * `onOpenInfo` 时（战斗里的敌人不是可操作对象）整卡不可点，名字只是静态文本。
 *
 * 卡片本身**无状态**：角色信息 / 奖励等浮窗的开关都归调用方（面板层）持有——同一张卡在两种
 * 场景里只是"长没长那颗按钮"的差别，不该各自记住一套浮窗状态。
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
  /** 属性行连攻 / 防一起给（**开局准备那一屏**：那时对方的硬属性会影响决策）。不给就只写 `HP x/y`。 */
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

      {/* 整卡可点的那一层：铺满卡面（含内边距）的透明按钮，叠在名字 / 属性之上。
          卡底动作按钮由 CSS 抬到它上面，所以「奖励」的点击不会被它截走。 */}
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
