import { describe, expect, it } from "vitest";
import { readAffixLabel, readAffixParts } from "./readAffixLabel";

describe("readAffixParts", () => {
  it("拆出 `[名称]` 与说明两段（全角冒号 / 多余空白也认）", () => {
    expect(readAffixParts("[破竹]:本段命中后更容易击穿格挡")).toEqual({
      name: "破竹",
      detail: "本段命中后更容易击穿格挡",
    });
    expect(readAffixParts("  [余音]  ：  余音未散  ")).toEqual({
      name: "余音",
      detail: "余音未散",
    });
  });

  it("解析不出名称时不猜：name 为 null、detail 是原文（不改写、不截断）", () => {
    expect(readAffixParts("[破竹]命中后更容易击穿格挡")).toEqual({
      name: null,
      detail: "[破竹]命中后更容易击穿格挡",
    });
    expect(readAffixParts("  []:命中后更容易击穿格挡  ")).toEqual({
      name: null,
      detail: "  []:命中后更容易击穿格挡  ",
    });
  });
});

describe("readAffixLabel", () => {
  it("`[名称]:描述` 只留名称（带方括号）", () => {
    expect(readAffixLabel("[破竹]:本段命中后更容易击穿格挡")).toBe("[破竹]");
  });

  it("全角冒号与多余空白也认", () => {
    expect(readAffixLabel("[纸灰]：回合结束时纸灰未落")).toBe("[纸灰]");
    expect(readAffixLabel("  [余音]  : 余音未散")).toBe("[余音]");
  });

  it("格式不合法的（LLM 写错）不猜，截断原文并补省略号", () => {
    expect(readAffixLabel("破竹—命中后更容易击穿格挡")).toBe("破竹—命中后更容易击...");
    expect(readAffixLabel("[破竹]命中后更容易击穿格挡")).toBe("[破竹]命中后更容易...");
  });

  it("短的不合法文本原样返回", () => {
    expect(readAffixLabel("破竹")).toBe("破竹");
  });

  it("把方括号里塞进第二对方括号当边界（不解析出名称）", () => {
    expect(readAffixLabel("[[破竹]]:命中后更容易击穿格挡")).toBe("[[破竹]]:命中后...");
  });

  it("名称是空的也当失败", () => {
    expect(readAffixLabel("[]:命中后更容易击穿格挡")).toBe("[]:命中后更容易击...");
  });
});
