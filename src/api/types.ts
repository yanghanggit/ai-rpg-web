/**
 * 从 OpenAPI 生成物（schema.d.ts）派生"可命名类型"的工具类型。
 *
 * 说明：请求/响应类型现在由 openapi-fetch / openapi-react-query 在调用点自动推导，
 * 这里主要用于需要显式命名的场合（组件 props、SSE 消息类型、领域函数签名）。
 */
import type { components, paths } from "./schema";

/** 后端 Pydantic 模型集合，例如 Schemas["NewGameResponse"]。 */
export type Schemas = components["schemas"];

/** 取出某个操作定义中 200 响应的 application/json 类型。 */
export type JsonResponse<Op> = Op extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : never;

/** 取出某个操作定义中请求体的 application/json 类型（无请求体时为 never）。 */
export type JsonBody<Op> = Op extends {
  requestBody: { content: { "application/json": infer R } };
}
  ? R
  : never;

/** 按路径取出其 GET 操作定义。 */
export type GetOperation<P extends keyof paths> = paths[P] extends { get: infer Op } ? Op : never;

/** 按路径取出其 POST 操作定义。 */
export type PostOperation<P extends keyof paths> = paths[P] extends { post: infer Op } ? Op : never;

/**
 * 按「路径 + 方法」取 200 响应类型。
 *
 * @example ApiResponse<"/api/login/v1/", "post">
 */
export type ApiResponse<P extends keyof paths, M extends "get" | "post"> = M extends "get"
  ? JsonResponse<GetOperation<P>>
  : JsonResponse<PostOperation<P>>;

/**
 * 按路径取 POST 请求体类型。
 *
 * @example ApiBody<"/api/login/v1/">
 */
export type ApiBody<P extends keyof paths> = JsonBody<PostOperation<P>>;
