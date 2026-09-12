import type { Schemas } from "../../api/types";
import { describeAgentEvent } from "./describeAgentEvent";

type SessionMessage = Schemas["SessionMessage"];

const DEFAULT_EMPTY_HINT = "还没有会话消息。点「推进一步」，角色的行动会出现在这里。";

/**
 * 叙事列表（纯展示）。
 *
 * 每条消息渲染成「谁 / 何地 / 什么事」三段——拆解规则见 `describeAgentEvent`。
 * 这里不做数据获取：拉取、累积、去重都在 `useSessionMessages` 里。
 */
export default function SessionMessageList({
  messages,
  emptyHint = DEFAULT_EMPTY_HINT,
}: {
  messages: SessionMessage[];
  emptyHint?: string;
}) {
  if (messages.length === 0) {
    return <p className="muted">{emptyHint}</p>;
  }

  return (
    <ol className="session" aria-label="会话消息">
      {messages.map((message) => {
        const event = message.agent_event;

        if (!event) {
          return (
            <li key={message.sequence_id}>
              <span className="badge">空</span>
            </li>
          );
        }

        const { label, who, where, what } = describeAgentEvent(event);

        return (
          <li key={message.sequence_id}>
            <div className="session-head">
              <span className="badge">{label}</span>
              {who ? <span className="who">{who}</span> : null}
              {where ? <span className="where">@ {where}</span> : null}
            </div>
            {what ? <p className="what">{what}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
