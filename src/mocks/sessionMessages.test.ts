import { beforeEach, describe, expect, it } from "vitest";
import { sessionMessagesFixture } from "./fixtures";
import {
  appendMockSessionMessage,
  readMockSessionMessages,
  resetMockSessionMessages,
} from "./sessionMessages";

describe("mock 会话消息表", () => {
  beforeEach(() => {
    resetMockSessionMessages();
  });

  it("初始内容来自共享 fixture", () => {
    expect(readMockSessionMessages(0)).toEqual(sessionMessagesFixture);
  });

  it("只返回 sequence_id 大于 since 的消息（与后端一致）", () => {
    const returned = readMockSessionMessages(3);

    expect(returned.map((message) => message.sequence_id)).toEqual([4, 5]);
  });

  it("追加的消息拿到递增的 sequence_id，且只被新增那一次捞到", () => {
    const lastSequenceId = sessionMessagesFixture.at(-1)?.sequence_id ?? 0;

    const sequenceId = appendMockSessionMessage({ type: 0, message: "新事件" });

    expect(sequenceId).toBe(lastSequenceId + 1);
    expect(readMockSessionMessages(lastSequenceId)).toEqual([
      { sequence_id: lastSequenceId + 1, agent_event: { type: 0, message: "新事件" } },
    ]);
  });

  it("reset 后回到初始 fixture（测试之间不互相污染）", () => {
    appendMockSessionMessage({ type: 0, message: "临时" });
    resetMockSessionMessages();

    expect(readMockSessionMessages(0)).toEqual(sessionMessagesFixture);
  });
});
