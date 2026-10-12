import { describe, expect, it } from "vitest";
import { findStageOfActor } from "./findStageOfActor";

const actorsByStage = {
  "场景.佣兵公会": ["角色.坏运气", "角色.无名"],
  "场景.酒馆": ["角色.麻雀"],
  "场景.铁匠铺": [],
};

describe("findStageOfActor", () => {
  it("返回角色所在的场景", () => {
    expect(findStageOfActor(actorsByStage, "角色.无名")).toBe("场景.佣兵公会");
    expect(findStageOfActor(actorsByStage, "角色.麻雀")).toBe("场景.酒馆");
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
