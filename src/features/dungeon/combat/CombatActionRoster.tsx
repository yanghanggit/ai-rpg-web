import { displayName } from "../../../components/displayName";
import { characterStatsText } from "../characterStatsText";
import { type Combatant, countOnHitAffixes, countTransferredCards, roleLabel } from "./readCombat";

/**
 * **行动面板（turn）的**参战者一览（横向滚动）：一格里放身份 / 名字 / HP 攻防 / 能量 / 总格挡 /
 * 手牌 [被动] / [塞牌] 数量。（结算页那份紧凑只读名单是 `CombatRoster`，两处**故意分开**：turn 的名单要承担
 * 排序与选目标，结算页暂时保持原样、后续再单独演化。）
 *
 * **名单本身就是行动顺序**：给了 `order`（当前回合的 `action_order`）就按它排——已行动
 * （`completed`）置灰、当前行动加绿框、其余读作「待行动」，所以不再单独画一条顺序条。
 *
 * 两个动作、两层含义：
 * - **整张卡**用铺满卡面的透明按钮实现（与 `ActorCard` 的 `actor-card-open` 同一手法）：
 *   选目标态（`picking`）下点卡 = 给选中的手牌指定目标；其余时候点卡 = 开角色信息（`onOpenInfo`）。
 * - **卡底常驻那颗按钮** = 看这个角色的手牌（`onOpenHand`）：**只给数量**——「[被动] N」
 *   （手牌里「被命中时」词缀的条数）与（仅敌方）「[塞牌] M」（手牌里来自我方阵营的牌数）。
 *   具体是哪张、什么词缀，点开手牌细看。
 *
 * 名字显示走 `displayName`（`怪物.纸人` → `纸人`），但 key / 比较一律用原始名。
 */
export default function CombatActionRoster({
  combatants,
  currentActor,
  pending = false,
  order,
  completed = [],
  picking = false,
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
  /** 点某名角色（指定为手牌目标）。 */
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
              <span>{characterStatsText(combatant.stats)}</span>
              <span>
                能量 {combatant.energy} · 总格挡 {combatant.block}
              </span>
            </p>
            {/* 卡底常驻按钮：看这个角色的手牌，只给数量（明细点开手牌细看）；「[塞牌]」只有敌方才有意义 */}
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
