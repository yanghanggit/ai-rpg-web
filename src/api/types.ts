/**
 * 从 OpenAPI 生成物派生的工具类型：只保留需要显式命名的场合（组件 props / 领域函数签名）。
 * 请求 / 响应类型由 openapi-fetch 在调用点自动推导。
 */
import type { components, paths } from "./schema";

/** 后端 Pydantic 模型集合，例如 Schemas["NewGameResponse"]。 */
export type Schemas = components["schemas"];

/** 取出某个操作定义中请求体的 application/json 类型（无请求体时为 never）。 */
export type JsonBody<Op> = Op extends {
  requestBody: { content: { "application/json": infer R } };
}
  ? R
  : never;

/** 按路径取出其 POST 操作定义。 */
export type PostOperation<P extends keyof paths> = paths[P] extends { post: infer Op } ? Op : never;

/**
 * 按路径取 POST 请求体类型。
 *
 * @example ApiBody<"/api/login/v1/">
 */
export type ApiBody<P extends keyof paths> = JsonBody<PostOperation<P>>;
