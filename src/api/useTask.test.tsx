import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { useTask } from "./useTask";

/**
 * QueryClient 必须跨渲染稳定，否则每次渲染都新建、缓存被重置。
 * 故在工厂里建一次，再让 wrapper 闭包引用它。
 */
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 收集「按调用次数变化」的 tasks 响应，返回调用计数读取函数。 */
function mockTasksByCall(build: (call: number) => { status: string; error?: string | null }) {
  const counter = { calls: 0 };
  server.use(
    http.get(api("/api/tasks/v1/status"), () => {
      const { status, error = null } = build(counter.calls);
      counter.calls += 1;
      return HttpResponse.json({ tasks: [{ job_id: "job-1", status, error }] });
    }),
  );
  return () => counter.calls;
}

describe("useTask", () => {
  it("jobId 为空时不发请求，也不进入运行态", async () => {
    let calls = 0;
    server.use(
      http.get(api("/api/tasks/v1/status"), () => {
        calls += 1;
        return HttpResponse.json({ tasks: [] });
      }),
    );

    const { result } = renderHook(() => useTask(null), { wrapper: createWrapper() });
    await sleep(40);

    expect(calls).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.status).toBeUndefined();
  });

  it("轮询到 completed 后停止", async () => {
    const calls = mockTasksByCall((call) => ({
      status: call < 3 ? "running" : "completed",
    }));

    const { result } = renderHook(() => useTask("job-1", { pollIntervalMs: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isCompleted).toBe(true));
    expect(calls()).toBeGreaterThanOrEqual(3);

    // 终态后不再发请求
    const settled = calls();
    await sleep(80);
    expect(calls()).toBe(settled);
  });

  it("failed 时带出后端记录的错误文本", async () => {
    mockTasksByCall(() => ({ status: "failed", error: "数据库连接失败" }));

    const { result } = renderHook(() => useTask("job-1", { pollIntervalMs: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isFailed).toBe(true));
    expect(result.current.error).toBe("数据库连接失败");
    expect(result.current.isCompleted).toBe(false);
  });

  it("查不到任务（tasks 为空）不算失败，继续轮询", async () => {
    let calls = 0;
    server.use(
      http.get(api("/api/tasks/v1/status"), () => {
        calls += 1;
        return HttpResponse.json({ tasks: [] });
      }),
    );

    const { result } = renderHook(() => useTask("job-1", { pollIntervalMs: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(3));
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.status).toBeUndefined();
  });

  it("超过 timeoutMs 仍未终态则停止轮询并置 isTimedOut", async () => {
    const calls = mockTasksByCall(() => ({ status: "running" }));

    const { result } = renderHook(() => useTask("job-1", { pollIntervalMs: 10, timeoutMs: 40 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isTimedOut).toBe(true));
    expect(result.current.isRunning).toBe(false);

    const settled = calls();
    await sleep(80);
    expect(calls()).toBe(settled);
  });

  it("轮询请求失败时暴露 pollError，但不把任务误判为失败", async () => {
    // 模拟后端对非法 job_id 的契约校验拒绝（422）
    server.use(
      http.get(api("/api/tasks/v1/status"), () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ["query", "job_ids"],
                msg: "String should match pattern",
                type: "string_pattern_mismatch",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );

    const { result } = renderHook(() => useTask("job-1", { pollIntervalMs: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.pollError).toBeTruthy());
    // 轮询失败 ≠ 任务失败，两者不能混为一谈
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isCompleted).toBe(false);
  });
});
