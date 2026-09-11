/**
 * 根路由 `/` 响应的窄化视图。
 *
 * 契约缺口说明：后端 `get_api_info` 的返回标注为 `Dict[str, Any]`，没有 Pydantic
 * response_model，因此 OpenAPI / schema.d.ts 只能生成 `{ [key: string]: unknown }`，
 * 无法直接拿到字段类型。这里在缺口上做一次显式收窄 + 运行时校验。
 *
 * 若后端为根路由补上 response_model，应删除本文件的字段定义，改为直接使用 `ServerInfoResponse`。
 */
import type { ApiResponse } from "./types";

/** 根路由的原始响应类型（由生成物推导，当前为 `{ [key: string]: unknown }`）。 */
export type ServerInfoResponse = ApiResponse<"/", "get">;

/** 后端根路由实际返回的字段（见 ai-rpg/scripts/run_game_server.py）。 */
export interface ServerInfo {
  service: string;
  status: string;
  version: string;
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

/** 将后端返回的 `{[key: string]: unknown}` 校验并转换为 ServerInfo；字段缺失时返回 undefined。 */
export function toServerInfo(raw: ServerInfoResponse): ServerInfo | undefined {
  const service = readString(raw, "service");
  const status = readString(raw, "status");
  const version = readString(raw, "version");
  if (service === undefined || status === undefined || version === undefined) {
    return undefined;
  }
  return { service, status, version };
}
