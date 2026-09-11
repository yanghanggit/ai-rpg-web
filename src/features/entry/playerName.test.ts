import { describe, expect, it } from "vitest";
import { generatePlayerName } from "./playerName";

describe("generatePlayerName", () => {
  it("把日期与时分编入玩家名", () => {
    expect(generatePlayerName(new Date(2025, 8, 11, 12, 56))).toBe("player-20250911-1256");
  });

  it("月份和时分补零", () => {
    expect(generatePlayerName(new Date(2025, 0, 3, 4, 5))).toBe("player-20250103-0405");
  });

  it("同一分钟内一致，跨分钟则不同", () => {
    const a = generatePlayerName(new Date(2025, 8, 11, 12, 56, 10));
    const b = generatePlayerName(new Date(2025, 8, 11, 12, 56, 59));
    const c = generatePlayerName(new Date(2025, 8, 11, 12, 57, 0));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
