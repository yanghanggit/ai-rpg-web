/**
 * 合并两批会话消息：按 `sequence_id` 去重、升序排列（轮询会反复拿到同一批，必须幂等）。
 *
 * **没有新消息时返回原数组引用**，否则每轮轮询都会触发一次无意义的重渲染。
 */
import type { Schemas } from "../../api/types";

type SessionMessage = Schemas["SessionMessage"];

export function mergeSessionMessages(
  existing: SessionMessage[],
  incoming: readonly SessionMessage[],
): SessionMessage[] {
  if (incoming.length === 0) {
    return existing;
  }

  const known = new Set(existing.map((message) => message.sequence_id));
  const added = incoming.filter((message) => !known.has(message.sequence_id));
  if (added.length === 0) {
    return existing;
  }

  const bySequence = new Map<number, SessionMessage>();
  for (const message of [...existing, ...added]) {
    bySequence.set(message.sequence_id, message);
  }

  return [...bySequence.values()].sort((a, b) => a.sequence_id - b.sequence_id);
}
