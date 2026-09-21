import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActorCard from "./ActorCard";

/**
 * `ActorCard` 的单元测试：整卡可点与否、`extra` 第二行、动作区有无、动作按钮拦点击——这四件事
 * 决定它在开场房（有奖励按钮 + 卡组张数）与战斗开局（敌人 / 队伍同款，只是没有卡底动作）里的长相。
 */
describe("ActorCard", () => {
  it("给 onOpenInfo：整卡是一个可点按钮（名字不再是独立按钮）", () => {
    const onOpenInfo = vi.fn();
    render(<ActorCard name="无名" badge="玩家" stats={null} onOpenInfo={onOpenInfo} />);

    const open = screen.getByRole("button", { name: "查看角色：无名" });
    expect(open).toHaveClass("actor-card-open");
    expect(screen.getByText("玩家")).toBeInTheDocument();

    fireEvent.click(open);
    expect(onOpenInfo).toHaveBeenCalledTimes(1);
  });

  it("不给 onOpenInfo：整卡不可点，名字是静态文本", () => {
    render(<ActorCard name="纸人" badge="怪物" stats={null} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("纸人")).toBeInTheDocument();
  });

  it("extra 是属性下的第二行；不给就不占行", () => {
    const { rerender } = render(<ActorCard name="无名" stats={null} extra="卡组 9" />);
    expect(screen.getByText("卡组 9")).toBeInTheDocument();

    rerender(<ActorCard name="无名" stats={null} />);
    expect(screen.queryByText("卡组 9")).not.toBeInTheDocument();
  });

  it("children 进卡底动作区；不给就不渲染动作区", () => {
    const { rerender } = render(
      <ActorCard name="无名" stats={null}>
        <button type="button">生成奖励</button>
      </ActorCard>,
    );
    expect(screen.getByRole("button", { name: "生成奖励" })).toBeInTheDocument();

    rerender(<ActorCard name="无名" stats={null} />);
    expect(screen.queryByRole("button", { name: "生成奖励" })).not.toBeInTheDocument();
  });

  it("卡底动作按钮拦下点击：点它不会顺带开出角色信息", () => {
    const onOpenInfo = vi.fn();
    const onReward = vi.fn();
    render(
      <ActorCard name="无名" stats={null} onOpenInfo={onOpenInfo}>
        <button type="button" onClick={onReward}>
          生成奖励
        </button>
      </ActorCard>,
    );

    fireEvent.click(screen.getByRole("button", { name: "生成奖励" }));
    expect(onReward).toHaveBeenCalledTimes(1);
    expect(onOpenInfo).not.toHaveBeenCalled();
  });
});
