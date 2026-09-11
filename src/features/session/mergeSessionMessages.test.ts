import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import { mergeSessionMessages } from "./mergeSessionMessages";

type SessionMessage = Schemas["SessionMessage"];

const message = (sequenceId: number): SessionMessage => ({
  sequence_id: sequenceId,
  agent_event: { type: 0, message: `第 ${sequenceId} 条` },
});

describe("mergeSessionMessages", () => {
  it("把新消息追加到已有序列表尾部", () => {
    const existing = [message(1), message(2)];

    expect(mergeSessionMessages(existing, [message(3)])).toEqual([
      message(1),
      message(2),
      message(3),
    ]);
  });

  it("重复拉取同一批消息时幂等，且返回原数组引用（避免无谓重渲染）", () => {
    const existing = [message(1), message(2)];

    expect(mergeSessionMessages(existing, [message(2), message(1)])).toBe(existing);
  });

  it("乱序到达也能按 sequence_id 升序排列", () => {
    const merged = mergeSessionMessages([message(1), message(3)], [message(2)]);

    expect(merged.map((item) => item.sequence_id)).toEqual([1, 2, 3]);
  });

  it("空批次返回原数组引用", () => {
    const existing = [message(1)];

    expect(mergeSessionMessages(existing, [])).toBe(existing);
  });

  it("从空列表开始也能工作", () => {
    expect(mergeSessionMessages([], [message(2), message(1)])).toEqual([message(1), message(2)]);
  });
});
