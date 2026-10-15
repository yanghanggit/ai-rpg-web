/**
 * 在场景映射中查找某个角色所在的场景。
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
