/**
 * 在场景映射中查找某个角色所在的场景。
 *
 * 口径与 TUI 的 `tui/cmd_combat.py: find_stage_of_actor` 一致：
 * `actors_by_stage` 是「场景 → 角色名列表」，一个角色只会出现在一个场景里。
 * 找不到（映射未加载 / 玩家身份未知）返回 `null`。
 *
 * 「场景状态」到「当前场景」的推导属于容易写错、又最好测的一段，单独抽纯函数。
 */
import type { Schemas } from "../../api/types";

export function findStageOfActor(
  actorsByStage: Schemas["StagesStateResponse"]["actors_by_stage"],
  actorName: string | null | undefined,
): string | null {
  if (!actorName) {
    return null;
  }

  for (const [stage, actors] of Object.entries(actorsByStage)) {
    if (actors.includes(actorName)) {
      return stage;
    }
  }

  return null;
}
