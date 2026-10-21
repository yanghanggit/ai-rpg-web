import type { ReactNode } from "react";
import { useState } from "react";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import ActorCard from "../ActorCard";
import { type Combatant, roleLabel } from "./readCombat";

/**
 * 战斗的上下阵（进房那一屏与结算共用）：上排敌人、下排我方，中间放这一屏的动作。
 *
 * 不管 phase、不放按钮，只负责排阵与「点卡看角色信息」。卡片顺序照 `combatants` 给的原序。
 */
export default function CombatField({
  userName,
  gameName,
  label,
  combatants,
  children,
}: {
  userName: string;
  gameName: string;
  /** 这一屏的名字（`region` 的无障碍名：「对阵」/「战斗结算」）。 */
  label: string;
  combatants: Combatant[];
  /** 中间那一段：这一屏唯一要做的事。 */
  children: ReactNode;
}) {
  // 正在看角色信息的成员（原始名）；非空即打开角色信息浮窗
  const [infoActor, setInfoActor] = useState<string | null>(null);

  const card = (combatant: Combatant) => (
    <ActorCard
      key={combatant.name}
      name={combatant.name}
      badge={roleLabel(combatant)}
      stats={combatant.stats}
      dead={combatant.dead}
      onOpenInfo={() => setInfoActor(combatant.name)}
    />
  );

  return (
    <>
      <section className="combat-field" aria-label={label}>
        <section className="cards cards--party" aria-label="敌人">
          {combatants.filter((combatant) => combatant.faction === "monster").map(card)}
        </section>

        <div className="combat-field-center">{children}</div>

        <section className="cards cards--party" aria-label="队伍">
          {combatants.filter((combatant) => combatant.faction !== "monster").map(card)}
        </section>
      </section>

      {infoActor === null ? null : (
        <ActorInfoDialog
          userName={userName}
          gameName={gameName}
          actorName={infoActor}
          // 副本进行中家园接口会被拒，角色信息里不提供穿 / 脱时装
          costumeEnabled={false}
          onClose={() => setInfoActor(null)}
        />
      )}
    </>
  );
}
