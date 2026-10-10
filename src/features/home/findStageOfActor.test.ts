import { describe, expect, it } from "vitest";
import { findStageOfActor } from "./findStageOfActor";

const actorsByStage = {
  "场景.酒吧大厅": ["角色.螳螂", "角色.零号"],
  "场景.后巷工位": ["角色.麻雀"],
  "场景.阁楼隔间": [],
};

describe("findStageOfActor", () => {
  it("返回角色所在的场景", () => {
    expect(findStageOfActor(actorsByStage, "角色.零号")).toBe("场景.酒吧大厅");
    expect(findStageOfActor(actorsByStage, "角色.麻雀")).toBe("场景.后巷工位");
  });

  it("角色不在任何场景时返回 null", () => {
    expect(findStageOfActor(actorsByStage, "角色.查无此人")).toBeNull();
  });

  it("actorName 为空时返回 null（身份尚未解析出来）", () => {
    expect(findStageOfActor(actorsByStage, null)).toBeNull();
    expect(findStageOfActor(actorsByStage, undefined)).toBeNull();
    expect(findStageOfActor(actorsByStage, "")).toBeNull();
  });
});
