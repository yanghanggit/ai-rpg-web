import { useState } from "react";
import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import type { Item } from "../../items/types";
import { COMBAT_RESULT } from "./combatPhase";
import LootDialog from "./LootDialog";
import { useCollectLoot } from "./useCollectLoot";

/** 胜负 → 结语与配色。 */
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
 * 战斗结算（`COMPLETE / POST_COMBAT`，对应 TUI `CombatPostScreen`）。
 *
 * **只留"现在该做什么"**：一行胜负 + （有战利品时）战利品入口。参战者、全部回合这类**查阅型**
 * 信息在标题行 ⚙「副本操作 → 战斗信息」里（任何 phase 都能开）；战利品的内容则在**本页那颗按钮
 * 打开的 `LootDialog` 里先摊开看**，收下后进背包（道具管理）——所以结算页不常驻名单 / 回合记录 /
 * 战利品清单，避免与那几处重复。
 *
 * **收取是"两步"**：那颗按钮只**打开浮窗**（先把 `LootComponent.items` 显示出来），真正的收取
 * 在浮窗里点「收取全部」——与开场房的 `SpoilsDialog` 同一套渐进式披露。没有战利品（未掉落 / 已收 /
 * 战败）时按钮不出现，页面自然只剩那一行胜负。
 *
 * **收取这件事由本组件自己持有**（不劳烦父层）：`useCollectLoot`（`LootComponent` → 背包的**同步**
 * 接口）。成功后战利品清空，顺手把浮窗关掉（没什么可看了）。
 *
 * **本间的结束动作不在这里**：它是标题行那颗 →（`RoomScaffold` 的 `roomAction`，由页面接线）。
 * 那个动作不推进副本、也不套确认框——它只是把人送到房间之间的地图（最后一间、或战败时改为直接
 * 离开副本），推进是在地图上才发生的事（「前往下一间」，那里有确认框，因为推进不可逆）。所以
 * “结束就是结束”，零服务端调用。
 *
 * **单向门**：结束即回地图（本间此后进不去），所以没收的战利品就留在身上拿不到了
 * （`collect_loot` 要求当前房间还是这间战斗房）——只**提醒不阻止**（惩罚是设计要的）。
 */
export default function CombatPostPanel({
  userName,
  gameName,
  combat,
  loot,
}: {
  userName: string;
  gameName: string;
  combat: Schemas["Combat"];
  loot: Item[];
}) {
  const collect = useCollectLoot(userName, gameName);
  const result = resultLabel(combat.result);
  const collectError = collect.isError ? describeApiError(collect.error) : null;
  /** 战利品浮窗开没开（只有点了入口才开；收完即关）。 */
  const [isLootOpen, setIsLootOpen] = useState(false);

  return (
    <>
      <p className={result.className}>{result.text}</p>

      {loot.length === 0 ? null : (
        <div className="toolbar">
          <button
            type="button"
            className="button--pending"
            // 后果放在 title 里：不再为它单占一行页面提示
            title="结束本间后就无法再收了。"
            onClick={() => setIsLootOpen(true)}
          >
            {`收取战利品（${loot.length}）`}
            <span className="button-mark" aria-hidden="true">
              !
            </span>
          </button>
        </div>
      )}

      {isLootOpen ? (
        <LootDialog
          loot={loot}
          busy={collect.isPending}
          error={collectError}
          // 收完把浮窗关上（loot 随即变空，没什么可看）；失败则留在浮窗里显示原因
          onCollect={() => collect.mutate(undefined, { onSuccess: () => setIsLootOpen(false) })}
          onClose={() => setIsLootOpen(false)}
        />
      ) : null}
    </>
  );
}
