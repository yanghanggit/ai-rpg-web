import { describe, expect, it } from "vitest";
import { displayName } from "./displayName";

describe("displayName", () => {
  it("取最后一段：服务器名字是「类型.名字」", () => {
    expect(displayName("角色.无名")).toBe("无名");
    expect(displayName("场景.门厅")).toBe("门厅");
    expect(displayName("世界.副本生成系统")).toBe("副本生成系统");
    expect(displayName("装备.缠麻短刃")).toBe("缠麻短刃");
    expect(displayName("消耗品.吗啡针剂")).toBe("吗啡针剂");
    expect(displayName("神器.纸钱方孔")).toBe("纸钱方孔");
    expect(displayName("怪物.纸人")).toBe("纸人");
  });

  it("多于两段时同样只留最后一段", () => {
    expect(displayName("a.b.c")).toBe("c");
    expect(displayName("副本.二楼.卧室")).toBe("卧室");
  });

  it("没有分隔符的名字原样返回", () => {
    // 蓝图名 / 玩家名不是「类型.名字」体系，不该被切
    expect(displayName("Game1")).toBe("Game1");
    expect(displayName("世界储物箱")).toBe("世界储物箱");
    expect(displayName("player-20260912-170000-abcd1234")).toBe("player-20260912-170000-abcd1234");
  });

  it("脏名字（空串、首尾点、连续点）也不返回空字符串", () => {
    expect(displayName("")).toBe("");
    expect(displayName(".")).toBe(".");
    expect(displayName("..")).toBe("..");
    expect(displayName("角色.")).toBe("角色");
    expect(displayName(".无名")).toBe("无名");
    expect(displayName("角色..无名")).toBe("无名");
  });
});
