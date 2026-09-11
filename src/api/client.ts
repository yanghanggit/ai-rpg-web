/**
 * 后端 API 客户端封装。
 * 基础地址来自 VITE_API_BASE_URL，默认 http://localhost:8000。
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST ${path} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** 拼接完整 URL（用于 SSE、图片等需要完整地址的场景）。 */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
