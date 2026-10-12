import { displayName } from "../../../components/displayName";
import { characterStatsText } from "../characterStatsText";
import { type Combatant, countOnHitAffixes, countTransferredCards, roleLabel } from "./readCombat";

/**
 * 行动面板（turn）的参战者一览（横向滚动）：一格里放身份 / 名字 + 两行数字 + 卡底入口。
 *
 * 第一行数字与开局准备屏同一份（`characterStatsText(stats, true)`），第二行是本屏独有的
 * `能量 · 手牌 · 总格挡`。名单按 `order`（当前回合 `action_order`）排，本身就是行动顺序：
 * 已行动置灰、当前绿框、其余待行动。整卡点击 = 选目标（`picking`）或开角色信息；卡底那行
 * = 看该角色手牌（`[被动] N`，敌方另加 `[塞牌] M`）。名字显示走 `displayName`，key 用原名。
 */
export default function CombatActionRoster({
  combatants,
  currentActor,
  pending = false,
  order,
  completed = [],
  picking = false,
  targets = [],
  onPick,
  onOpenInfo,
  onOpenHand,
}: {
  combatants: Combatant[];
  currentActor: string | null;
  /** 参战者快照还没取回来：显示加载中，而不是「暂无参战者」。 */
  pending?: boolean;
  /** 行动顺序（原始名）；给了就按它排列名单。 */
  order?: string[];
  /** 已行动的角色（原始名）→ 置灰 +「已行动」。 */
  completed?: string[];
  /** 正在为一张手牌选目标：存活角色整卡可点（优先于 `onOpenInfo`）。 */
  picking?: boolean;
  /** 玩家已选中的目标集（原始名）：命中集里的卡都**下移**（`all` / `spread` 是整阵营）。 */
  targets?: string[];
  /** 点某名角色：选中 / 取消它作为手牌目标（**不直接出牌**）。 */
  onPick?: (name: string) => void;
  /** 点整张卡（非选目标态）→ 开角色信息。 */
  onOpenInfo?: (name: string) => void;
  /** 点卡底按钮 → 看该角色的手牌。 */
  onOpenHand?: (name: string) => void;
}) {
  // 行动队列 = 活着的人（`Round.action_order` 是回合开始时的快照，不含战死者）
  const alive = combatants.filter((combatant) => !combatant.dead);

  if (alive.length === 0) {
    return <p className="muted">{pending ? "加载参战者…" : "场景内暂无参战者。"}</p>;
  }

  // 给了行动顺序就按它排；不在顺序里的（理论上没有）排到最后，保持原相对次序。
  const ordered =
    order === undefined || order.length === 0
      ? alive
      : [...alive].sort((a, b) => {
          const rank = (name: string) => {
            const index = order.indexOf(name);
            return index === -1 ? order.length : index;
          };
          return rank(a.name) - rank(b.name);
        });
  const completedSet = new Set(completed);

  return (
    <ul className="combat-action-roster" aria-label="参战者">
      {ordered.map((combatant) => {
        const isCurrent = combatant.name === currentActor;
        const isCompleted = !isCurrent && completedSet.has(combatant.name);
        const isPickable = picking && onPick !== undefined;
        const isTarget = targets.includes(combatant.name);
        const classes = ["combatant-card"];
        if (combatant.player) {
          classes.push("combatant-card--you");
        }
        if (isCurrent) {
          classes.push("combatant-card--current");
        }
        if (isCompleted) {
          classes.push("combatant-card--done");
        }
        if (isPickable) {
          classes.push("combatant-card--pick");
        }
        if (isTarget) {
          classes.push("combatant-card--target");
        }
        const onHitCount = countOnHitAffixes(combatant);
        const transferredCount = countTransferredCards(combatant, combatants);
        return (
          <li
            key={combatant.name}
            className={classes.join(" ")}
            aria-current={isCurrent ? "true" : undefined}
          >
            <div className="card-head">
              <span className="chip mono">{displayName(combatant.name)}</span>
              {/* 玩家本人的身份徽标用「你」，一眼认出自己那一格 */}
              <span className="badge">{combatant.player ? "你" : roleLabel(combatant)}</span>
              {isCurrent ? <span className="badge badge--current">当前行动</span> : null}
              {isCompleted ? <span className="badge">已行动</span> : null}
            </div>
            <p className="muted actor-card-stats">
              {/* 第一行与开局准备屏同一份（`showAttackDefense`）：两张屏的角色卡读上去是一张卡 */}
              <span>{characterStatsText(combatant.stats, true)}</span>
              <span>
                能量 {combatant.energy} · 手牌 {combatant.hand.length} · 总格挡 {combatant.block}
              </span>
            </p>
            {/* 卡底常驻按钮：看该角色手牌；手牌数已在第二行，词缀槽就是它的「图标」 */}
            <button
              type="button"
              className="combatant-card-hand"
              aria-label={`查看手牌：${displayName(combatant.name)}`}
              onClick={() => onOpenHand?.(combatant.name)}
            >
              <span className="combatant-card-hand-text">
                <span className="affix-chip affix-chip--hit">[被动] {onHitCount}</span>
                {combatant.faction === "monster" ? (
                  <span className="affix-chip affix-chip--transfer">[塞牌] {transferredCount}</span>
                ) : null}
              </span>
              <span className="combatant-card-hand-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            {/* 整卡可点：选目标态 → 指定目标；否则 → 看角色信息 */}
            {isPickable ? (
              <button
                type="button"
                className="actor-card-open"
                aria-label={`选择目标：${displayName(combatant.name)}`}
                onClick={() => onPick(combatant.name)}
              />
            ) : onOpenInfo === undefined ? null : (
              <button
                type="button"
                className="actor-card-open"
                aria-label={`查看角色：${displayName(combatant.name)}`}
                onClick={() => onOpenInfo(combatant.name)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
