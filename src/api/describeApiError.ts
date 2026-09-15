/**
 * 把任意错误转成「给玩家看的一句话」。
 *
 * 后端（FastAPI）用 `{ detail: "..." }` 说明业务原因（如「当前不在家园状态，不能进行家园操作」），
 * 这句话比 `ApiError.message`（形如 `API 400`）有用得多，所以优先取它、取不到再退回 message。
 *
 * 两种错误形状都要认：
 * - **变更**（`useMutation` + `unwrap`）抛的是 `ApiError`，响应体在 `error.body`；
 * - **查询**（`$api.useQuery`）抛的是**响应体本身**（openapi-react-query 直接 `throw error`，
 *   不包一层），所以也要直接在错误对象上找 `detail`——否则界面上只剩 `[object Object]`。
 *
 * 家园 / 道具 / 副本的 hook 都需要这段逻辑，收在这里一份，不在各处复制。
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
  // 查询错误：`error` 就是响应体，直接找 detail
  return detailOf(error) ?? (error instanceof Error ? error.message : String(error));
}
