/**
 * 工坊合成（消耗品 / 装备 / 时装）。
 *
 * `POST /api/home/craft/*` 只返回 `job_id`，真正的合成由 home pipeline 任务完成，
 * 结果通过会话消息通知——等待与失效交给 `src/api/useJobAction.ts`（见 docs/api-layer.md 六）。
 *
 * 三个工坊的请求体与响应体完全一致（都是 `HomeCraftItemRequest/Response`），
 * 只是路径不同，所以合成入口用 `workshop` 参数区分。
 */
import { client, unwrap } from "../../api/client";
import { useJobAction } from "../../api/useJobAction";
import { invalidateEntitiesAndMessages } from "../entities/invalidateEntities";

/** 三个工坊；路径里的段名即工坊名（消耗品端点已从 `item` 正名为 `consumable`）。 */
export type Workshop = "consumable" | "gear" | "costume";

export function useCraftItem(userName: string, gameName: string) {
  const job = useJobAction({
    request: async ({ workshop, materials }: { workshop: Workshop; materials: string[] }) => {
      const body = { user_name: userName, game_name: gameName, materials };
      switch (workshop) {
        case "consumable":
          return unwrap(await client.POST("/api/home/craft/consumable/v1/", { body }));
        case "gear":
          return unwrap(await client.POST("/api/home/craft/gear/v1/", { body }));
        case "costume":
          return unwrap(await client.POST("/api/home/craft/costume/v1/", { body }));
      }
    },
    onCompleted: invalidateEntitiesAndMessages,
  });

  // 对外保持「工坊 + 材料名」两个参数，不把内部的动作参数对象泄露给页面
  return {
    ...job,
    start: (workshop: Workshop, materials: string[]) => job.start({ workshop, materials }),
  };
}
