/**
 * SSE（Server-Sent Events）读取器：流式 `fetch` + 手动解析 `data:` 行。
 *
 * 为什么不用浏览器原生 `EventSource`（尽管 docs/web-client-plan.md 最初如此设想）：
 * - `EventSource` 不能携带 `Authorization` 头，JWT 接入后无法鉴权；本项目约定
 *   认证头只在 `client.ts` 的 `authHeaders()` 注入，这里复用同一份。
 * - 它自带断线重连语义，而后端唯一的 SSE 端点 `watch` 是「等到任务终态即正常结束」
 *   的一次性流。自动重连会把「正常结束」当成断线反复重连，反而要额外代码把它关掉。
 * - 单测环境是 jsdom（没有 `EventSource`）+ MSW；流式 `fetch` 才能被 MSW 拦截与断言。
 *
 * 因此与 TUI（`tui/server_client.py` 的 `client.stream` + `aiter_lines`）保持一致：
 * 用流式 `fetch`，逐行读取，只认 `data:` 行。
 */
import { ApiError, apiUrl, authHeaders } from "./client";

export interface StreamSseOptions {
  /** 放弃/中断连接（如组件卸载、jobId 变化时）。 */
  signal?: AbortSignal;
}

/**
 * 请求一个 SSE 端点，按顺序异步产出每条事件的 `data:` 载荷（不含前缀与换行）。
 *
 * 非 2xx 抛 `ApiError`；流正常/异常结束时生成器收尾并释放底层连接。
 */
export async function* streamSseData(
  path: string,
  { signal }: StreamSseOptions = {},
): AsyncGenerator<string, void, void> {
  const response = await globalThis.fetch(apiUrl(path), {
    method: "GET",
    headers: { Accept: "text/event-stream", ...authHeaders() },
    signal,
  });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text().catch(() => null));
  }
  if (!response.body) {
    throw new ApiError(response.status, "SSE 响应缺少 body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // 一行一行地消费；最后一段可能是不完整行，留在 buffer 里等下一次 chunk
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const data = readDataLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (data !== null) {
          yield data;
        }
        newline = buffer.indexOf("\n");
      }
    }
    // 流结束前若还剩一行没有换行结尾，也要处理
    const data = readDataLine(buffer);
    if (data !== null) {
      yield data;
    }
  } finally {
    // 提前 return（如读到终态）时取消底层连接，避免连接泄漏
    await reader.cancel().catch(() => undefined);
  }
}

/** 解析一行 SSE 文本：`data: xxx` → `xxx`；空行 / 注释 / 其它字段 → `null`。 */
function readDataLine(line: string): string | null {
  const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
  if (!trimmed.startsWith("data:")) {
    return null;
  }
  return trimmed.slice("data:".length).trim();
}
