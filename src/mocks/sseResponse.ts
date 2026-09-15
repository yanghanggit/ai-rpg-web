/**
 * 把一串 `data:` 载荷包成 MSW 的 SSE 流式响应。
 *
 * 后端两个 SSE 端点 `Content-Type` 都是 `text/event-stream`、每条事件形如
 * `data: {json}\n\n`；测试与 `pnpm dev:mock` 用同一套 handler，所以解析/拼帧逻辑
 * 只放在这里一处。
 */

/**
 * @param payloads 依次推送的 `data:` 载荷；同步/异步可迭代都可以（异步可用来做真实延时）。
 *
 * 返回原生 `Response` 而非 `HttpResponse`：MSW 的 `HttpResponse` 泛型约束在
 * `DefaultBodyType` 之内，装不下 `ReadableStream`；MSW 的 resolver 接受原生 `Response`。
 */
export function sseResponse(payloads: Iterable<string> | AsyncIterable<string>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const payload of payloads) {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}
