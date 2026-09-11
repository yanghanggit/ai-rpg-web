import type { Schemas } from "../../api/types";

type AgentEvent = NonNullable<Schemas["SessionMessage"]["agent_event"]>;

/**
 * 事件类型 → 展示标签。
 *
 * `type` 是**数字**（后端用 `IntEnum`：1=说话、2=耳语、3=宣布、4=内心、5=疑问、
 * 6=转场、7..10=战斗相关）。`AgentEvent` 的 `type` 是宽泛的 `number`，会落到
 * default 分支——那正是后端"未分类事件"的兜底形态，所以 default 不是错误分支。
 * 本轮只做家园，战斗类事件（7..10）也给个标签，免得出现看不懂的原始文本。
 *
 * 注：这些数字字面量能正常收窄，靠的是 scripts/genApi.mjs 生成前删掉了
 * 非字符串的 discriminator（原因见那里与 docs/api-layer.md）。
 */
function describeEvent(event: AgentEvent): string {
  switch (event.type) {
    case 1:
      return "说";
    case 2:
      return "私语";
    case 3:
      return "宣布";
    case 4:
      return "内心";
    case 5:
      return "疑问";
    case 6:
      return "转场";
    case 7:
      return "遭遇";
    case 8:
      return "战斗裁决";
    case 9:
      return "战斗结算";
    case 10:
      return "外观";
    default:
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
