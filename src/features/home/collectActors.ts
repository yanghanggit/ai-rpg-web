/**
 * 从家园状态里挑出「要推进的角色」。
 *
 * 单独抽成纯函数：它是后端契约（`StagesStateResponse.actors_by_stage`）到请求参数
 * （`HomeAdvanceRequest.actors`）的映射，属于最容易写错、又最好测的一段。
 */
import type { Schemas } from "../../api/types";

export function collectActors(
  actorsByStage: Schemas["StagesStateResponse"]["actors_by_stage"],
): string[] {
  const actors: string[] = [];
  const seen = new Set<string>();

  for (const stageActors of Object.values(actorsByStage)) {
    for (const actor of stageActors) {
      if (seen.has(actor)) {
        continue;
      }
      seen.add(actor);
      actors.push(actor);
    }
  }

  return actors;
}
