import { describe, expect, it } from "vitest";
import { readPartyRoster } from "./readPartyRoster";

describe("readPartyRoster", () => {
  it("读出 PartyRosterComponent.members", () => {
    expect(
      readPartyRoster({
        name: "角色.无名",
        components: [
          {
            name: "PartyRosterComponent",
            data: { name: "角色.无名", members: ["角色.顾知秋", "角色.小厮"] },
          },
        ],
      }),
    ).toEqual(["角色.顾知秋", "角色.小厮"]);
  });

  it("组件缺失（名单为空时后端会移除该组件）时返回空数组", () => {
    expect(readPartyRoster({ name: "角色.无名", components: [] })).toEqual([]);
  });

  it("字段形状不对时丢弃非法项（不猜）", () => {
    expect(
      readPartyRoster({
        name: "角色.无名",
        components: [
          {
            name: "PartyRosterComponent",
            data: { name: "角色.无名", members: ["角色.顾知秋", 5, ""] },
          },
        ],
      }),
    ).toEqual(["角色.顾知秋"]);

    expect(
      readPartyRoster({
        name: "角色.无名",
        components: [
          { name: "PartyRosterComponent", data: { name: "角色.无名", members: "不是数组" } },
        ],
      }),
    ).toEqual([]);
  });
});
