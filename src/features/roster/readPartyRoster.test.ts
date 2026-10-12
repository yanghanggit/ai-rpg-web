import { describe, expect, it } from "vitest";
import { COMPONENT } from "../entities/componentNames";
import { readPartyRoster } from "./readPartyRoster";

describe("readPartyRoster", () => {
  it("读出 PartyRosterComponent.members", () => {
    expect(
      readPartyRoster({
        name: "角色.无名",
        data: {
          [COMPONENT.PartyRoster]: {
            name: "角色.无名",
            members: ["角色.坏运气", "角色.麻雀"],
          },
        },
      }),
    ).toEqual(["角色.坏运气", "角色.麻雀"]);
  });

  it("组件缺失（名单为空时后端会移除该组件）时返回空数组", () => {
    expect(readPartyRoster({ name: "角色.无名", data: {} })).toEqual([]);
  });

  it("字段形状不对时丢弃非法项（不猜）", () => {
    expect(
      readPartyRoster({
        name: "角色.无名",
        data: {
          [COMPONENT.PartyRoster]: { name: "角色.无名", members: ["角色.坏运气", 5, ""] },
        },
      }),
    ).toEqual(["角色.坏运气"]);

    expect(
      readPartyRoster({
        name: "角色.无名",
        data: {
          [COMPONENT.PartyRoster]: { name: "角色.无名", members: "不是数组" },
        },
      }),
    ).toEqual([]);
  });
});
