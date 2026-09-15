import { describe, expect, it } from "vitest";
import { findStageOfActor } from "./findStageOfActor";

const mapping = {
  "场景.门厅": ["角色.顾知秋", "角色.无名"],
  "场景.一楼客房": ["角色.小厮"],
  "场景.二楼卧室": [],
};

describe("findStageOfActor", () => {
  it("返回角色所在的场景", () => {
    expect(findStageOfActor(mapping, "角色.无名")).toBe("场景.门厅");
    expect(findStageOfActor(mapping, "角色.小厮")).toBe("场景.一楼客房");
  });

  it("角色不在任何场景时返回 null", () => {
    expect(findStageOfActor(mapping, "角色.查无此人")).toBeNull();
  });

  it("actorName 为空时返回 null（身份尚未解析出来）", () => {
    expect(findStageOfActor(mapping, null)).toBeNull();
    expect(findStageOfActor(mapping, undefined)).toBeNull();
    expect(findStageOfActor(mapping, "")).toBeNull();
  });
});
