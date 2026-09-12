import type { Schemas } from "../../api/types";

type AgentEvent = NonNullable<Schemas["SessionMessage"]["agent_event"]>;

/**
 * 把一条 agent_event 拆成「谁 / 何地 / 什么事」三段展示信息。
 *
 * 为什么不直接渲染 `agent_event.message`：那是后端为流式日志准备的单行文本
 * （形如 `# 角色.顾知秋 内心活动: …`），**不含 stage**。而"这条消息发生在哪个场景"
 * 只有结构化字段里才有，所以这里按事件类型重新组装，不依赖 message。
 *
 * `what` 允许为空字符串（场景转换本身没有台词），由调用方决定是否渲染那一段。
 *
 * 关于开头的 `"stage" in event`：这不是运行时兜底，而是**类型收窄的必要步骤**。
 * 后端事件基类 `AgentEvent`（未分类事件的兜底形态）的 `type` 是宽泛的 `str`，
 * 与所有字面量都兼容，因此它会一直留在每个 `case` 分支里；不先把它排除掉，
 * 就取不到具体事件的专有字段（actor / stage / content …）。
 */
export function describeAgentEvent(event: AgentEvent) {
  // 最后一道防线：后端将来新增了事件类型而前端还没跟上时，至少还能显示原始文本
  const fallback = { label: "事件", who: "", where: "", what: event.message };

  if (!("stage" in event)) {
    return fallback;
  }

  switch (event.type) {
    case "speak":
      return {
        label: "说",
        who: event.actor,
        where: event.stage,
        what: `对 ${event.target} 说：${event.content}`,
      };
    case "whisper":
      return {
        label: "私语",
        who: event.actor,
        where: event.stage,
        what: `对 ${event.target} 耳语：${event.content}`,
      };
    case "announce":
      return { label: "宣布", who: event.actor, where: event.stage, what: event.content };
    case "mind":
      return { label: "内心", who: event.actor, where: event.stage, what: event.content };
    case "trans_stage":
      // 场景转换的「何地」是"从哪到哪"，所以箭头放进 where 而不是 what
      return {
        label: "转场",
        who: event.actor,
        where: `${event.stage} → ${event.target}`,
        what: "",
      };
    case "combat_arbitration":
      // 裁决是面向全体场景的，没有单一行动者；combat_log 是原始日志，这里只取叙述
      return { label: "战斗裁决", who: "", where: event.stage, what: event.narrative };
    case "appearance_update":
      return { label: "外观", who: event.actor, where: event.stage, what: event.appearance };
    default:
      return fallback;
  }
}
