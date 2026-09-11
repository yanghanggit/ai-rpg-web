/**
 * 从家园状态里挑出「要推进的角色」。
 *
 * 口径与 TUI 的 `cmd_advance.py` 一致：**全部场景中出现过的全部角色**，
 * 跨场景去重、保持首次出现顺序（顺序会影响后端生成的叙事，所以不排序）。
 *
 * 单独抽成纯函数：它是后端契约（`StagesStateResponse.mapping`）到请求参数
 * （`HomeAdvanceRequest.actors`）的映射，属于最容易写错、又最好测的一段。
 */
import type { Schemas } from "../../api/types";

export function collectActors(mapping: Schemas["StagesStateResponse"]["mapping"]): string[] {
  const actors: string[] = [];
  const seen = new Set<string>();

  for (const stageActors of Object.values(mapping)) {
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
