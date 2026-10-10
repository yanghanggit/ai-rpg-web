import { describe, expect, it } from "vitest";
import type { Schemas } from "../../api/types";
import { describeAgentEvent } from "./describeAgentEvent";

type AgentEvent = NonNullable<Schemas["SessionMessage"]["agent_event"]>;

describe("describeAgentEvent", () => {
  it("说话：谁 对 谁 说 / 何地 / 内容", () => {
    const event: AgentEvent = {
      type: "speak",
      message: "（message 不应被使用）",
      actor: "角色.螳螂",
      stage: "场景.酒吧大厅",
      target: "角色.零号",
      content: "你到此几日哉？",
    };

    expect(describeAgentEvent(event)).toEqual({
      label: "说",
      who: "螳螂",
      where: "酒吧大厅",
      what: "对 零号 说：你到此几日哉？",
    });
  });

  it("内心：何地取 stage，而不是 message 里的文本", () => {
    const event: AgentEvent = {
      type: "mind",
      message: "# 角色.螳螂 内心活动: 酒吧大厅里静得反常。",
      actor: "角色.螳螂",
      stage: "场景.酒吧大厅",
      content: "酒吧大厅里静得反常。",
    };

    const parts = describeAgentEvent(event);

    expect(parts.where).toBe("酒吧大厅");
    expect(parts.what).toBe("酒吧大厅里静得反常。");
    // message 里没有 stage，这正是不能直接渲染 message 的原因
    expect(event.message).not.toContain("场景.酒吧大厅");
  });

  it("转场：何地是「从哪到哪」，没有 what", () => {
    const event: AgentEvent = {
      type: "trans_stage",
      message: "（忽略）",
      actor: "角色.零号",
      stage: "场景.酒吧大厅",
      target: "场景.后巷工位",
    };

    expect(describeAgentEvent(event)).toEqual({
      label: "转场",
      who: "零号",
      where: "酒吧大厅 → 后巷工位",
      what: "",
    });
  });

  it("名字出口前都过了 displayName：actor / target / stage 只留最后一段", () => {
    const event: AgentEvent = {
      type: "whisper",
      message: "（忽略）",
      actor: "角色.螳螂",
      stage: "场景.阁楼隔间",
      target: "怪物.门神",
      content: "别出声。",
    };

    const parts = describeAgentEvent(event);

    expect(parts.who).toBe("螳螂");
    expect(parts.where).toBe("阁楼隔间");
    expect(parts.what).toBe("对 门神 耳语：别出声。");
  });

  it("战斗裁决：没有单一行动者，何事取 narrative 而非 combat_log", () => {
    const event: AgentEvent = {
      type: "combat_arbitration",
      message: "（忽略）",
      stage: "场景.酒吧大厅",
      combat_log: "原始日志",
      narrative: "两人错身而过，谁也没占到便宜。",
    };

    expect(describeAgentEvent(event)).toEqual({
      label: "战斗裁决",
      who: "",
      where: "酒吧大厅",
      what: "两人错身而过，谁也没占到便宜。",
    });
  });

  it("外观更新：何事取 appearance", () => {
    const event: AgentEvent = {
      type: "appearance_update",
      message: "（忽略）",
      actor: "角色.螳螂",
      stage: "场景.酒吧大厅",
      appearance: "换上了藕荷色衫裙。",
    };

    expect(describeAgentEvent(event).what).toBe("换上了藕荷色衫裙。");
  });

  it('未分类事件（type "none"）退回到 message，且不带 who/where', () => {
    const event: AgentEvent = {
      type: "none",
      message: "引擎输出的兜底形态。",
    };

    expect(describeAgentEvent(event)).toEqual({
      label: "事件",
      who: "",
      where: "",
      what: "引擎输出的兜底形态。",
    });
  });

  it("每种具体事件都有中文标签（不留英文 type 给用户看）", () => {
    const events: AgentEvent[] = [
      { type: "speak", message: "", actor: "a", stage: "s", target: "t", content: "c" },
      { type: "whisper", message: "", actor: "a", stage: "s", target: "t", content: "c" },
      { type: "announce", message: "", actor: "a", stage: "s", content: "c" },
      { type: "mind", message: "", actor: "a", stage: "s", content: "c" },
      { type: "trans_stage", message: "", actor: "a", stage: "s", target: "t" },
      {
        type: "combat_arbitration",
        message: "",
        stage: "s",
        combat_log: "l",
        narrative: "n",
      },
      { type: "appearance_update", message: "", actor: "a", stage: "s", appearance: "ap" },
    ];

    for (const event of events) {
      expect(describeAgentEvent(event).label).toMatch(/^[\u4e00-\u9fa5]+$/);
    }
  });
});
