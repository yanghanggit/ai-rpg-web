import { displayName } from "../../components/displayName";
import type { Combatant } from "./readCombat";

/** 阵营 / 身份 → 界面标签，与 TUI `role_label` 一致（玩家 / 队友 / 怪物）。 */
function roleLabel(combatant: Combatant): string {
  if (combatant.faction === "monster") {
    return "怪物";
  }
  if (combatant.player) {
    return "玩家";
  }
  if (combatant.faction === "party") {
    return "队友";
  }
  return "？";
}

function statsText(combatant: Combatant): string {
  if (combatant.stats === null) {
    return "（无属性数据）";
  }
  return `HP ${combatant.stats.hp}/${combatant.stats.max_hp} · 攻 ${combatant.stats.attack} · 防 ${combatant.stats.defense}`;
}

/**
 * 参战者一览：每个角色一张紧凑卡片（身份 / 名字 / 血量攻防 / 能量格挡牌堆）。
 *
 * 当前 turn 角色加绿框 + 「当前行动」徽标，已战死的置灰——一眼看出轮到谁。
 * 名字显示走 `displayName`（`怪物.纸人` → `纸人`），但 key / 比较一律用原始名。
 */
export default function CombatRoster({
  combatants,
  currentActor,
  pending = false,
}: {
  combatants: Combatant[];
  currentActor: string | null;
  /** 参战者快照还没取回来：显示加载中，而不是「暂无参战者」。 */
  pending?: boolean;
}) {
  if (combatants.length === 0) {
    return <p className="muted">{pending ? "加载参战者…" : "场景内暂无参战者。"}</p>;
  }

  return (
    <ul className="combat-roster">
      {combatants.map((combatant) => {
        const isCurrent = combatant.name === currentActor;
        const classes = ["combatant"];
        if (isCurrent) {
          classes.push("combatant--current");
        }
        if (combatant.dead) {
          classes.push("combatant--dead");
        }
        return (
          <li key={combatant.name} className={classes.join(" ")}>
            <div className="combatant-head">
              <span className="badge">{roleLabel(combatant)}</span>
              <span className="combatant-name">{displayName(combatant.name)}</span>
              {combatant.dead ? <span className="badge badge--dead">已战死</span> : null}
              {isCurrent ? <span className="badge badge--current">当前行动</span> : null}
            </div>
            <p className="muted combatant-stats">{statsText(combatant)}</p>
            <p className="muted combatant-stats">
              能量 {combatant.energy} · 格挡 {combatant.block} · 抽 {combatant.piles.draw} / 弃{" "}
              {combatant.piles.discard} / 消耗 {combatant.piles.exhaust}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
