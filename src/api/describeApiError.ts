/**
 * 把任意错误转成「给玩家看的一句话」。
 *
 * 后端（FastAPI）用 `{ detail: "..." }` 说明业务原因（如「当前不在家园状态，不能进行家园操作」），
 * 这句话比 `ApiError.message`（形如 `API 400`）有用得多，所以优先取它、取不到再退回 message。
 *
 * 家园 / 道具 / 副本的动作 hook 都需要这段逻辑，收在这里一份，不在各处复制。
 */
import { ApiError } from "./client";

/** 从错误体里取 `detail`；不是非空字符串则返回 `null`。 */
function detailOf(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "detail" in body) {
    return typeof body.detail === "string" && body.detail !== "" ? body.detail : null;
  }
  return null;
}

export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return detailOf(error.body) ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
