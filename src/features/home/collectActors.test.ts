import { describe, expect, it } from "vitest";
import { collectActors } from "./collectActors";

describe("collectActors", () => {
  it("收集全部场景的全部角色，并保持首次出现顺序", () => {
    expect(
      collectActors({
        "场景.佣兵公会": ["角色.坏运气", "角色.无名"],
        "场景.酒馆": ["角色.麻雀"],
        "场景.铁匠铺": [],
      }),
    ).toEqual(["角色.坏运气", "角色.无名", "角色.麻雀"]);
  });

  it("跨场景去重，保留首次出现的位置", () => {
    expect(
      collectActors({
        "场景.佣兵公会": ["角色.无名"],
        "场景.酒馆": ["角色.无名", "角色.麻雀"],
      }),
    ).toEqual(["角色.无名", "角色.麻雀"]);
  });

  it("空映射返回空数组（页面据此禁用推进按钮）", () => {
    expect(collectActors({})).toEqual([]);
  });

  it("所有场景都没有角色时同样返回空数组", () => {
    expect(collectActors({ "场景.佣兵公会": [], "场景.铁匠铺": [] })).toEqual([]);
  });
});
