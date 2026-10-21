import { useState } from "react";
import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import type { Item } from "../../items/types";
import CombatField from "./CombatField";
import { COMBAT_RESULT } from "./combatPhase";
import LootDialog from "./LootDialog";
import type { Combatant } from "./readCombat";
import { useCollectLoot } from "./useCollectLoot";

/** 胜负 → 中间的结语与配色。 */
function resultLabel(result: number): { text: string; className: string } {
  if (result === COMBAT_RESULT.WIN) {
    return { text: "🏆 战斗胜利！", className: "ok" };
  }
  if (result === COMBAT_RESULT.LOSE) {
    return { text: "💀 战斗失败。", className: "error" };
  }
  return { text: "战斗已结束。", className: "muted" };
}

/**
 * 战斗结算（`COMPLETE / POST_COMBAT`）：与进房那一屏同一套上下阵，中间放结语与收取入口。
 *
 * 战死的人卡上挂「已战死」。查阅型信息（全部回合）在 ⚙「战斗信息」里。收取是两步：入口摊开
 * `LootDialog`，真正收取在浮窗里点「收取全部」；没战利品时入口不出现。结束动作在标题行。
 */
export default function CombatPostPanel({
  userName,
  gameName,
  combat,
  combatants,
  loot,
}: {
  userName: string;
  gameName: string;
  combat: Schemas["Combat"];
  combatants: Combatant[];
  loot: Item[];
}) {
  const collect = useCollectLoot(userName, gameName);
  const result = resultLabel(combat.result);
  const collectError = collect.isError ? describeApiError(collect.error) : null;
  const [isLootOpen, setIsLootOpen] = useState(false);

  return (
    <>
      <CombatField userName={userName} gameName={gameName} label="战斗结算" combatants={combatants}>
        <p className={`combat-result ${result.className}`}>{result.text}</p>

        {loot.length === 0 ? null : (
          <button
            type="button"
            className="combat-start button--pending"
            // 后果放在 title 里：不再为它单占一行页面提示
            title="结束本间后就无法再收了。"
            onClick={() => setIsLootOpen(true)}
          >
            {`收取战利品（${loot.length}）`}
            <span className="button-mark" aria-hidden="true">
              !
            </span>
          </button>
        )}
      </CombatField>

      {isLootOpen ? (
        <LootDialog
          loot={loot}
          busy={collect.isPending}
          error={collectError}
          // 收完关掉浮窗；失败则留在浮窗里显示原因
          onCollect={() => collect.mutate(undefined, { onSuccess: () => setIsLootOpen(false) })}
          onClose={() => setIsLootOpen(false)}
        />
      ) : null}
    </>
  );
}
