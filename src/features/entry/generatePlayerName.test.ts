import { describe, expect, it } from "vitest";
import { generatePlayerName } from "./generatePlayerName";

describe("generatePlayerName", () => {
  it("把日期、秒级时间与随机后缀编入名字", () => {
    expect(generatePlayerName(new Date(2025, 8, 11, 12, 56, 7), "a1b2c3d4")).toBe(
      "player-20250911-125607-a1b2c3d4",
    );
  });

  it("月/日/时/分/秒均补零", () => {
    expect(generatePlayerName(new Date(2025, 0, 3, 4, 5, 6), "0f0f0f0f")).toBe(
      "player-20250103-040506-0f0f0f0f",
    );
  });

  it("时间到秒：同一分钟的不同秒会产生不同名字", () => {
    const a = generatePlayerName(new Date(2025, 8, 11, 12, 56, 7), "aaaaaaaa");
    const b = generatePlayerName(new Date(2025, 8, 11, 12, 56, 8), "aaaaaaaa");
    expect(a).not.toBe(b);
  });

  it("同一秒内靠随机后缀也不重名", () => {
    const now = new Date(2025, 8, 11, 12, 56, 7);
    expect(generatePlayerName(now, "aaaaaaaa")).not.toBe(generatePlayerName(now, "bbbbbbbb"));
  });

  it("默认后缀为 8 位小写十六进制，且连续两次不同", () => {
    const now = new Date(2025, 8, 11, 12, 56, 7);
    const a = generatePlayerName(now);
    const b = generatePlayerName(now);
    expect(a).toMatch(/^player-\d{8}-\d{6}-[0-9a-f]{8}$/);
    expect(b).toMatch(/^player-\d{8}-\d{6}-[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });
});
