import { displayName } from "../../../components/displayName";
import { readAffixLabel } from "../../cards/readAffixLabel";
import { characterStatsText } from "../characterStatsText";
import { type Combatant, roleLabel } from "./readCombat";

/**
 * 参战者卡上的「手牌受击词缀」摘要：聚合这人手牌里全部 `on_hit_affixes` 的 `[名称]`（去重）。
 *
 * 口径与怪物 AI 的 `_OpponentView.revealed_cards`（"带受击词缀的牌对对手公开"）一致——
 * 上方名单出摘要、下方手牌看全文，同一件事两种颗粒度。
 */
function onHitLabels(combatant: Combatant): string[] {
  const labels = combatant.hand.flatMap((card) => card.on_hit_affixes).map(readAffixLabel);
  return [...new Set(labels)];
}

/**
 * **行动面板（turn）的**参战者一览（横向滚动）：一格里放身份 / 名字 / HP 攻防 / 能量 / 总格挡 /
 * 手牌受击词缀。（结算页那份紧凑只读名单是 `CombatRoster`，两处**故意分开**：turn 的名单要承担
 * 排序与选目标，结算页暂时保持原样、后续再单独演化。）
 *
 * **名单本身就是行动顺序**：给了 `order`（当前回合的 `action_order`）就按它排——已行动
 * （`completed`）置灰、当前行动加绿框、其余读作「待行动」，所以不再单独画一条顺序条。
 *
 * 给 `onPick` 时整卡可点（点一名角色 = 给选中的手牌指定目标）；这层用**铺满卡面的透明按钮**
 * 实现（与 `ActorCard` 的 `actor-card-open` 同一手法），所以点卡面任何地方都能选中目标。
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
}: {
  combatants: Combatant[];
  currentActor: string | null;
  /** 参战者快照还没取回来：显示加载中，而不是「暂无参战者」。 */
  pending?: boolean;
  /** 行动顺序（原始名）；给了就按它排列名单。 */
  order?: string[];
  /** 已行动的角色（原始名）→ 置灰 +「已行动」。 */
  completed?: string[];
  /** 正在为一张手牌选目标：存活角色整卡可点。 */
  picking?: boolean;
  /** 点某名角色（指定为手牌目标）。 */
  onPick?: (name: string) => void;
}) {
  if (combatants.length === 0) {
    return <p className="muted">{pending ? "加载参战者…" : "场景内暂无参战者。"}</p>;
  }

  // 给了行动顺序就按它排；不在顺序里的（理论上没有）排到最后，保持原相对次序。
  const ordered =
    order === undefined || order.length === 0
      ? combatants
      : [...combatants].sort((a, b) => {
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
        const isPickable = picking && !combatant.dead && onPick !== undefined;
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
        if (combatant.dead) {
          classes.push("combatant-card--dead");
        }
        if (isPickable) {
          classes.push("combatant-card--pick");
        }
        const affixes = onHitLabels(combatant);
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
              {combatant.dead ? <span className="badge badge--dead">已战死</span> : null}
            </div>
            <p className="muted actor-card-stats">
              <span>{characterStatsText(combatant.stats)}</span>
              <span>
                能量 {combatant.energy} · 总格挡 {combatant.block}
              </span>
            </p>
            {affixes.length === 0 ? null : (
              <p className="combatant-card-affixes">
                <span className="muted">受击词缀</span> {affixes.join(" ")}
              </p>
            )}
            {isPickable ? (
              <button
                type="button"
                className="actor-card-open"
                aria-label={`选择目标：${displayName(combatant.name)}`}
                onClick={() => onPick(combatant.name)}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
