/**
 * SSE 读取器：流式 `fetch` + 手动解析 `data:` 行。
 *
 * 不用原生 `EventSource`：它不能带 `Authorization` 头，且自带的断线重连不适合 `watch` 这种
 * 「到终态即结束」的一次性流；这里复用 `client.ts` 的 `authHeaders()`。
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
      // 一行一行消费；末段可能是不完整行，留在 buffer 里等下一次 chunk
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
