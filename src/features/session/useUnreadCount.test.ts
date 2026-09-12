import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUnreadCount } from "./useUnreadCount";

type Props = { total: number; isReady: boolean; isOpen: boolean };

function render(initial: Props) {
  return renderHook((props: Props) => useUnreadCount(props.total, props.isReady, props.isOpen), {
    initialProps: initial,
  });
}

describe("useUnreadCount", () => {
  it("首屏已有的历史不算未读（它不是「新消息」）", () => {
    const { result, rerender } = render({ total: 0, isReady: false, isOpen: false });

    rerender({ total: 5, isReady: true, isOpen: false });

    expect(result.current).toBe(0);
  });

  it("基线建立之后新到的消息算未读", () => {
    const { result, rerender } = render({ total: 0, isReady: false, isOpen: false });
    rerender({ total: 0, isReady: true, isOpen: false });
    expect(result.current).toBe(0);

    rerender({ total: 3, isReady: true, isOpen: false });
    expect(result.current).toBe(3);

    rerender({ total: 5, isReady: true, isOpen: false });
    expect(result.current).toBe(5);
  });

  it("首屏就是空局时，之后第一波新消息仍算未读", () => {
    const { result, rerender } = render({ total: 0, isReady: false, isOpen: false });
    rerender({ total: 0, isReady: true, isOpen: false });

    rerender({ total: 2, isReady: true, isOpen: false });

    expect(result.current).toBe(2);
  });

  it("打开浮层即清零", () => {
    const { result, rerender } = render({ total: 0, isReady: false, isOpen: false });
    rerender({ total: 5, isReady: true, isOpen: false });
    rerender({ total: 8, isReady: true, isOpen: false });
    expect(result.current).toBe(3);

    rerender({ total: 8, isReady: true, isOpen: true });

    expect(result.current).toBe(0);
  });

  it("浮层开着时新到的消息也不算未读（正在看，不该再提示）", () => {
    const { result, rerender } = render({ total: 2, isReady: false, isOpen: true });
    rerender({ total: 2, isReady: true, isOpen: true });

    rerender({ total: 6, isReady: true, isOpen: true });

    expect(result.current).toBe(0);
  });

  it("关闭浮层后，再新到的消息重新计为未读", () => {
    const { result, rerender } = render({ total: 0, isReady: false, isOpen: false });
    rerender({ total: 2, isReady: true, isOpen: false });
    rerender({ total: 2, isReady: true, isOpen: true });
    rerender({ total: 2, isReady: true, isOpen: false });

    rerender({ total: 7, isReady: true, isOpen: false });

    expect(result.current).toBe(5);
  });

  it("切换会话（isReady 先落回再抬起）会重记基线", () => {
    const { result, rerender } = render({ total: 0, isReady: false, isOpen: false });
    rerender({ total: 5, isReady: true, isOpen: false });
    rerender({ total: 9, isReady: true, isOpen: false });
    expect(result.current).toBe(4);

    // 换了一个会话：新会话已有 20 条历史，不该算成 20 条未读
    rerender({ total: 0, isReady: false, isOpen: false });
    rerender({ total: 20, isReady: true, isOpen: false });

    expect(result.current).toBe(0);
  });
});
