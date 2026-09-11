import type { Schemas } from "../../api/types";

type AgentEvent = NonNullable<Schemas["SessionMessage"]["agent_event"]>;

/**
 * 事件类型 → 展示标签。
 *
 * `type` 是后端定义的**字符串字面量**（见 ai-rpg 的 models/agent_event.py），
 * 生成类型里是闭合联合，所以每个 case 都能收窄到具体事件类型。
 * default 分支不是死代码：它在运行时兜住「后端新增了类型、前端还没跟上」的情况。
 */
function describeEvent(event: AgentEvent): string {
  switch (event.type) {
    case "speak":
      return "说";
    case "whisper":
      return "私语";
    case "announce":
      return "宣布";
    case "mind":
      return "内心";
    case "trans_stage":
      return "转场";
    case "combat_arbitration":
      return "战斗裁决";
    case "appearance_update":
      return "外观";
    default:
      // "none"（后端未分类事件的兜底形态）与将来新增的类型
      return "事件";
  }
}

/**
 * 叙事列表（纯展示）。
 *
 * 消息正文统一取 `agent_event.message`——后端已经把「谁、对谁、做了什么」编排进这句话，
 * 所以这里不需要按类型拼装文本，只做标签区分。将来若要按类型渲染富文本
 * （如战斗日志、对话气泡），改这里即可，不影响数据获取。
 */
export default function SessionMessageList({
  messages,
}: {
  messages: Schemas["SessionMessage"][];
}) {
  if (messages.length === 0) {
    return <p className="muted">还没有会话消息。点「推进一步」，角色的行动会出现在这里。</p>;
  }

  return (
    <ol className="session" aria-label="会话消息">
      {messages.map((message) => (
        <li key={message.sequence_id}>
          <span className="badge">
            {message.agent_event ? describeEvent(message.agent_event) : "空"}
          </span>{" "}
          {message.agent_event?.message ?? "（无内容）"}
        </li>
      ))}
    </ol>
  );
}
