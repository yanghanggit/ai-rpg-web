import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import { sseResponse } from "../mocks/sseResponse";
import { useTask } from "./useTask";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 逐条推送、每条之间留出间隔，用来观察「流进行中」的中间态。 */
async function* delayed(events: string[], gapMs: number): AsyncGenerator<string> {
  for (const event of events) {
    yield event;
    await sleep(gapMs);
  }
}

/** 一条 `TaskSnapshot` 事件载荷（后端 SSE 的 `data:` 内容）。 */
const taskEvent = (jobId: number, status: string, error: string | null = null) =>
  JSON.stringify({ job_id: jobId, status, error });

/**
 * 覆盖 watch 端点，按顺序推送给定事件（推完即关流）。
 * 返回调用计数读取函数：用于断言「jobId 为空不连接」「只建立一条流」。
 */
function mockWatch(build: (call: number) => Iterable<string> | AsyncIterable<string>) {
  const counter = { calls: 0 };
  server.use(
    http.get(api("/api/tasks/v1/watch/:jobId"), () => {
      const events = build(counter.calls);
      counter.calls += 1;
      return sseResponse(events);
    }),
  );
  return () => counter.calls;
}

describe("useTask", () => {
  it("jobId 为空时不建立连接，也不进入运行态", async () => {
    const calls = mockWatch(() => []);

    const { result } = renderHook(() => useTask(null));
    await sleep(40);

    expect(calls()).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.status).toBeUndefined();
  });

  it("读到 succeeded 后进入完成态，且只建立一条流", async () => {
    const calls = mockWatch(() => [
      taskEvent(1, "doing"),
      taskEvent(1, "doing"),
      taskEvent(1, "succeeded"),
    ]);

    const { result } = renderHook(() => useTask(1));

    await waitFor(() => expect(result.current.isCompleted).toBe(true));
    expect(result.current.isRunning).toBe(false);
    // 终态即断开，不会像轮询那样反复建连
    expect(calls()).toBe(1);
  });

  it("流进行中时保持 isRunning，并暴露中间状态", async () => {
    mockWatch(() => delayed([taskEvent(1, "doing"), taskEvent(1, "succeeded")], 300));

    const { result } = renderHook(() => useTask(1));

    await waitFor(() => expect(result.current.status).toBe("doing"));
    expect(result.current.isRunning).toBe(true);

    await waitFor(() => expect(result.current.isCompleted).toBe(true));
    expect(result.current.isRunning).toBe(false);
  });

  it("failed 时带出后端记录的错误文本", async () => {
    mockWatch(() => [taskEvent(1, "doing"), taskEvent(1, "failed", "数据库连接失败")]);

    const { result } = renderHook(() => useTask(1));

    await waitFor(() => expect(result.current.isFailed).toBe(true));
    expect(result.current.error).toBe("数据库连接失败");
    expect(result.current.isCompleted).toBe(false);
  });

  it("收到服务端 timeout 事件时置 isTimedOut（超时由服务端判定）", async () => {
    mockWatch(() => [taskEvent(1, "doing"), JSON.stringify({ error: "timeout", job_id: 1 })]);

    const { result } = renderHook(() => useTask(1, { timeoutSeconds: 1 }));

    await waitFor(() => expect(result.current.isTimedOut).toBe(true));
    expect(result.current.isRunning).toBe(false);
  });

  it("流在终态前结束视为超时（与 TUI 的 TimeoutError 一致）", async () => {
    mockWatch(() => [taskEvent(1, "doing")]);

    const { result } = renderHook(() => useTask(1));

    await waitFor(() => expect(result.current.isTimedOut).toBe(true));
    expect(result.current.isRunning).toBe(false);
  });

  it("任务不存在时暴露 streamError，但不把任务误判为失败", async () => {
    mockWatch(() => [JSON.stringify({ error: "task_not_found", job_id: 1 })]);

    const { result } = renderHook(() => useTask(1));

    await waitFor(() => expect(result.current.streamError).toBeTruthy());
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.isRunning).toBe(false);
  });

  it("连接失败（HTTP 错误）时暴露 streamError，但不把任务误判为失败", async () => {
    // 模拟后端对非法 job_id 的契约校验拒绝（422）
    server.use(
      http.get(api("/api/tasks/v1/watch/:jobId"), () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ["path", "job_id"],
                msg: "Input should be a valid integer",
                type: "int_parsing",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );

    const { result } = renderHook(() => useTask(1));

    await waitFor(() => expect(result.current.streamError).toBeTruthy());
    // 连接失败 ≠ 任务失败，两者不能混为一谈
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isCompleted).toBe(false);
  });
});
