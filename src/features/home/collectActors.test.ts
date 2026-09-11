import { describe, expect, it } from "vitest";
import { collectActors } from "./collectActors";

describe("collectActors", () => {
  it("收集全部场景的全部角色，并保持首次出现顺序", () => {
    expect(
      collectActors({
        "场景.门厅": ["角色.顾知秋", "角色.无名"],
        "场景.一楼客房": ["角色.小厮"],
        "场景.二楼卧室": [],
      }),
    ).toEqual(["角色.顾知秋", "角色.无名", "角色.小厮"]);
  });

  it("跨场景去重，保留首次出现的位置", () => {
    expect(
      collectActors({
        "场景.门厅": ["角色.无名"],
        "场景.一楼客房": ["角色.无名", "角色.小厮"],
      }),
    ).toEqual(["角色.无名", "角色.小厮"]);
  });

  it("空映射返回空数组（页面据此禁用推进按钮）", () => {
    expect(collectActors({})).toEqual([]);
  });

  it("所有场景都没有角色时同样返回空数组", () => {
    expect(collectActors({ "场景.门厅": [], "场景.二楼卧室": [] })).toEqual([]);
  });
});
