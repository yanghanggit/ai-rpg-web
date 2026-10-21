import type { ReactNode } from "react";
import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import ActorChip from "./ActorChip";

/**
 * 竖置的角色卡（dungeon 内唯一实现，开场房与战斗开局共用）。
 *
 * 不给 `children` 时立绘区吃掉内框剩余高度（准备屏要的是面积）。卡上没有词条区，攻 / 防 / 速
 * 与总格挡也不在这张卡上（还没抓牌，只有 HP 说得通）。给 `onOpenInfo` 时整卡可点。
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
  /** 定性（玩家 / 队友 / 怪物）；不给就不显示正下那枚 pill。 */
  badge?: string;
  /** 角色属性：卡上只取 HP **当前值**（全长 `x/y` 写在悬停说明里）；读不到就写 `—`。 */
  stats: Schemas["CharacterStats"] | null;
  /** 名字横幅下的一行状态（如「卡组 9」）；不给就不占行。 */
  extra?: string;
  /** 有则**整卡可点**（开角色信息浮窗）；没有就整卡不可点，名字是静态文本。 */
  onOpenInfo?: () => void;
  /** 卡内动作区（如奖励按钮）；不给就不渲染，立绘区顺势长大。 */
  children?: ReactNode;
}) {
  const classes = ["combatant-card", "actor-card"];
  if (onOpenInfo !== undefined) {
    classes.push("actor-card--open");
  }

  return (
    <article className={classes.join(" ")}>
      {/* 内框：立绘 / 名字 / 状态 / 动作都收在这一块里；底排的盾 / 心凸出于它 */}
      <div className="combatant-inner">
        {/* 立绘区（先空着）：没有词条区、没有动作区时，它就是整张卡最大的一块 */}
        <span className="combatant-art" aria-hidden="true" />

        {/* 名字横幅：与名单卡 / 手牌同一套（纯文本居中） */}
        <span className="combatant-name">{displayName(name)}</span>

        {extra === undefined ? null : <p className="actor-card-extra">{extra}</p>}

        {children === undefined ? null : <div className="actor-card-actions">{children}</div>}
      </div>

      {/* 右下 HP（心）：只显当前值，全长补在悬停说明里。左下那枚总格挡盾这里不画——
          还没抓牌，此时只有 HP 说得通 */}
      <ActorChip
        kind="hp"
        value={stats === null ? "—" : stats.hp}
        title={stats === null ? "HP" : `HP ${stats.hp}/${stats.max_hp}`}
      />

      {/* 正下：定性（阵营 / 身份） */}
      {badge === undefined ? null : <span className="combatant-role">{badge}</span>}

      {/* 整卡可点的透明层；卡内动作按钮由 CSS 抬到它上面 */}
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
