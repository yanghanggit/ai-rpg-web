import { describe, expect, it } from "vitest";
import { collectActors } from "./collectActors";

describe("collectActors", () => {
  it("收集全部场景的全部角色，并保持首次出现顺序", () => {
    expect(
      collectActors({
        "场景.酒吧大厅": ["角色.螳螂", "角色.零号"],
        "场景.后巷工位": ["角色.麻雀"],
        "场景.阁楼隔间": [],
      }),
    ).toEqual(["角色.螳螂", "角色.零号", "角色.麻雀"]);
  });

  it("跨场景去重，保留首次出现的位置", () => {
    expect(
      collectActors({
        "场景.酒吧大厅": ["角色.零号"],
        "场景.后巷工位": ["角色.零号", "角色.麻雀"],
      }),
    ).toEqual(["角色.零号", "角色.麻雀"]);
  });

  it("空映射返回空数组（页面据此禁用推进按钮）", () => {
    expect(collectActors({})).toEqual([]);
  });

  it("所有场景都没有角色时同样返回空数组", () => {
    expect(collectActors({ "场景.酒吧大厅": [], "场景.阁楼隔间": [] })).toEqual([]);
  });

  it("exclude 里的角色被剔除（已永久失能者不参与推进）", () => {
    expect(
      collectActors(
        {
          "场景.酒吧大厅": ["角色.螳螂", "角色.零号"],
          "场景.后巷工位": ["角色.麻雀"],
        },
        new Set(["角色.麻雀"]),
      ),
    ).toEqual(["角色.螳螂", "角色.零号"]);
  });
});
