/**
 * REST 请求的唯一入口：openapi-fetch 客户端。类型全部由 `schema.d.ts` 推导；认证 / 日志走 middleware。
 */
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API ${status}`);
    this.name = "ApiError";
  }
}

/**
 * 认证头：JWT 接入后由登录流程写入 localStorage。REST 走 middleware，SSE 复用同一份实现。
 */
export function authHeaders(): Record<string, string> {
  const token = globalThis.localStorage?.getItem("ai-rpg-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 认证中间件：token 统一在此注入，业务代码不需要感知 Authorization 头。
 */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    for (const [name, value] of Object.entries(authHeaders())) {
      request.headers.set(name, value);
    }
    return request;
  },
};

/** 开发期请求日志。 */
const loggerMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (import.meta.env.DEV) {
      console.debug(`[api] ${request.method} ${request.url} → ${response.status}`);
    }
    return response;
  },
};

export const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  // 延迟解析 globalThis.fetch（不在模块加载时锁定），方便单测注入与 MSW 拦截
  fetch: (input: Request) => globalThis.fetch(input),
});
client.use(authMiddleware);
client.use(loggerMiddleware);

/** 把 openapi-fetch 的 `{ data, error }` 结果转成 data，失败时抛 ApiError。 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined) {
    throw new ApiError(result.response.status, result.error);
  }
  if (result.data === undefined) {
    throw new ApiError(result.response.status, "响应缺少 data");
  }
  return result.data;
}

/** 拼接完整 URL（SSE、后端静态图片等非 openapi-fetch 场景使用）。 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * 用参数填充 OpenAPI 路径模板（`/a/{id}/b` → `/a/1/b`）。模板必须是 `keyof paths`，端点写错会编译报错。
 */
export function fillPath(template: keyof paths, params: Record<string, string | number>): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`缺少路径参数 "${key}"：${template}`);
    }
    return encodeURIComponent(String(value));
  });
}
