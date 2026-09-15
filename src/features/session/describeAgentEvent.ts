import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";

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
 * 事件里的 `actor` / `target` / `stage` 都是服务器名字，这里出口前一律过 `displayName`
 * （`角色.无名` → `无名`）——本函数产出的就是给玩家看的文本，原始名字只在数据层用。
 *
 * 事件联合是**按 `type` 判别**的（8 个字面量成员，含兜底的 `NoneEvent`），所以
 * `switch (event.type)` 能直接收窄到具体类型，取 `actor` / `stage` / `content` 都安全。
 */
export function describeAgentEvent(event: AgentEvent) {
  // 兑底：后端将来新增了事件类型而前端还没跟上时，至少还能显示原始文本。
  // `message` 在每个联合成员上都有，所以在收窄之前取——这样 default 分支不需要
  // 再访问 event 的任何专有字段（那些字段只有在收窄后才能拿到）。
  // 注：`NoneEvent`（`# ` 开头的系统日志行，如角色进出场景的通知）走的就是这条分支；
  // 它本是引擎给 LLM 的提示语、不是给玩家的叙事，后续应在叙事面板里整体隐藏。
  const fallback = { label: "事件", who: "", where: "", what: event.message };

  switch (event.type) {
    case "speak":
      return {
        label: "说",
        who: displayName(event.actor),
        where: displayName(event.stage),
        what: `对 ${displayName(event.target)} 说：${event.content}`,
      };
    case "whisper":
      return {
        label: "私语",
        who: displayName(event.actor),
        where: displayName(event.stage),
        what: `对 ${displayName(event.target)} 耳语：${event.content}`,
      };
    case "announce":
      return {
        label: "宣布",
        who: displayName(event.actor),
        where: displayName(event.stage),
        what: event.content,
      };
    case "mind":
      return {
        label: "内心",
        who: displayName(event.actor),
        where: displayName(event.stage),
        what: event.content,
      };
    case "trans_stage":
      // 场景转换的「何地」是"从哪到哪"，所以箭头放进 where 而不是 what
      return {
        label: "转场",
        who: displayName(event.actor),
        where: `${displayName(event.stage)} → ${displayName(event.target)}`,
        what: "",
      };
    case "combat_arbitration":
      // 裁决是面向全体场景的，没有单一行动者；combat_log 是原始日志，这里只取叙述
      return {
        label: "战斗裁决",
        who: "",
        where: displayName(event.stage),
        what: event.narrative,
      };
    case "appearance_update":
      return {
        label: "外观",
        who: displayName(event.actor),
        where: displayName(event.stage),
        what: event.appearance,
      };
    default:
      return fallback;
  }
}
