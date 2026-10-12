/**
 * 把任意错误转成给玩家看的一句话：优先取后端 `{ detail }`，取不到再退回 `message`。
 *
 * 两种形状都要认：变更抛 `ApiError`（响应体在 `error.body`），查询直接抛响应体本身。
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
