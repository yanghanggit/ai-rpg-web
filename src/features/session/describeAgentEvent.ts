import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";

type AgentEvent = NonNullable<Schemas["SessionMessage"]["agent_event"]>;

/**
 * 把一条 `agent_event` 拆成「谁 / 何地 / 什么事」。
 *
 * 不直接渲染 `agent_event.message`（那是给流式日志的单行文本，不含 stage）；`actor` / `target` /
 * `stage` 都是服务器名，出口前过 `displayName`。`what` 允许为空（场景转换没有台词）。
 */
export function describeAgentEvent(event: AgentEvent) {
  // 兜底：后端新增事件类型而前端还没跟上时至少还能显示原始文本（`NoneEvent` 也走这条分支）
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
