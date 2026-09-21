import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StageCard from "./StageCard";

/**
 * `StageCard` 的单元测试：三态的**可点性与无障碍名**是这块的全部逻辑（外观在 CSS 里）。
 * 页面级的那套（初始化失败 → 点卡重试、就绪 → 点卡看全文）在 `OpeningRoomPage.test.tsx` 里。
 */
describe("StageCard", () => {
  it("初始化中：显示「进行中…」，不可点（此刻没什么可做的）", () => {
    render(<StageCard state="running" body="进行中…" onActivate={() => {}} />);

    const card = screen.getByRole("button", { name: "场景描述：初始化中" });
    expect(card).toBeDisabled();
    expect(card).toHaveTextContent("进行中…");
  });

  it("失败：把原因写在卡上，点整张卡 = 重试初始化", () => {
    const onActivate = vi.fn();
    render(<StageCard state="failed" body="初始化失败：后端 500" onActivate={onActivate} />);

    const card = screen.getByRole("button", { name: "场景描述：重试初始化开场" });
    expect(card).toBeEnabled();
    expect(card).toHaveTextContent("初始化失败：后端 500");
    expect(card).toHaveClass("stage-card--failed");

    fireEvent.click(card);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("就绪：环境叙述当正文，点整张卡 = 看全文", () => {
    const onActivate = vi.fn();
    render(<StageCard state="ready" body="门轴涩住，风从棺缝里过。" onActivate={onActivate} />);

    const card = screen.getByRole("button", { name: "场景描述：查看场景信息" });
    expect(card).toHaveTextContent("门轴涩住，风从棺缝里过。");
    expect(card).toHaveClass("stage-card--ready");

    fireEvent.click(card);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
