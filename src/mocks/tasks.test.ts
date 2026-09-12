import { beforeEach, describe, expect, it } from "vitest";
import { createMockTask, readMockTasks, resetMockTasks } from "./tasks";

/** 与 tasks.ts 里的 MOCK_TASK_DURATION_MS 保持一致。 */
const MOCK_TASK_DURATION_MS = 2_000;

describe("mock 任务表", () => {
  beforeEach(() => {
    resetMockTasks();
  });

  it("新建的任务处于 doing", () => {
    const jobId = createMockTask(1_000);

    expect(readMockTasks([jobId], 1_000)).toEqual([
      { job_id: jobId, status: "doing", error: null },
    ]);
  });

  it("超过 mock 时长后变为 succeeded", () => {
    const jobId = createMockTask(1_000);

    expect(readMockTasks([jobId], 1_000 + MOCK_TASK_DURATION_MS - 1)[0]?.status).toBe("doing");
    expect(readMockTasks([jobId], 1_000 + MOCK_TASK_DURATION_MS)[0]?.status).toBe("succeeded");
  });

  it("未知 job_id 不出现在结果里（与后端 { tasks: [] } 一致）", () => {
    const jobId = createMockTask(1_000);

    expect(readMockTasks([jobId, 999999], 1_000)).toHaveLength(1);
    expect(readMockTasks([999999], 1_000)).toEqual([]);
  });

  it("job_id 是自增整数（对齐后端 procrastinate 的自增 id）", () => {
    expect(createMockTask(0)).toBe(1);
    expect(createMockTask(0)).toBe(2);
  });
});
