/**
 * mock 用的内存会话消息表。
 *
 * 让 `pnpm dev:mock` 下「推进 → 新叙事出现」这条回路可见——真实后端里这些消息由 NPC 行动产生。
 * 行为对齐后端：`since` 只返回 `sequence_id` 更大的消息；未知/空会话返回空数组。
 */
import type { Schemas } from "../api/types";
import { sessionMessagesFixture } from "./fixtures";

type SessionMessage = Schemas["SessionMessage"];
type AgentEvent = NonNullable<SessionMessage["agent_event"]>;

let messages: SessionMessage[] = [...sessionMessagesFixture];

/** 返回 `sequence_id` 大于 `since` 的消息（语义与后端 `/since` 一致）。 */
export function readMockSessionMessages(since: number): SessionMessage[] {
  return messages.filter((message) => message.sequence_id > since);
}

/** 追加一条消息，返回它的 sequence_id。 */
export function appendMockSessionMessage(event: AgentEvent): number {
  const sequenceId = (messages.at(-1)?.sequence_id ?? 0) + 1;
  messages.push({ sequence_id: sequenceId, agent_event: event });
  return sequenceId;
}

/** 复位成初始 fixture（测试之间隔离）。 */
export function resetMockSessionMessages(): void {
  messages = [...sessionMessagesFixture];
}
