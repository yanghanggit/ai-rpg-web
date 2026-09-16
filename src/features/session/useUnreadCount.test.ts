import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUnreadCount } from "./useUnreadCount";

type Props = { session: string; total: number; isReady: boolean; isOpen: boolean };

function render(initial: Props) {
  return renderHook(
    (props: Props) => useUnreadCount(props.session, props.total, props.isReady, props.isOpen),
    { initialProps: initial },
  );
}

describe("useUnreadCount", () => {
  it("首屏已有的历史不算未读（它不是「新消息」）", () => {
    const { result, rerender } = render({
      session: "u\u0000g",
      total: 0,
      isReady: false,
      isOpen: false,
    });

    rerender({ session: "u\u0000g", total: 5, isReady: true, isOpen: false });

    expect(result.current).toBe(0);
  });

  it("基线建立之后新到的消息算未读", () => {
    const { result, rerender } = render({
      session: "u\u0000g",
      total: 0,
      isReady: false,
      isOpen: false,
    });
    rerender({ session: "u\u0000g", total: 0, isReady: true, isOpen: false });
    expect(result.current).toBe(0);

    rerender({ session: "u\u0000g", total: 3, isReady: true, isOpen: false });
    expect(result.current).toBe(3);

    rerender({ session: "u\u0000g", total: 5, isReady: true, isOpen: false });
    expect(result.current).toBe(5);
  });

  it("首屏就是空局时，之后第一波新消息仍算未读", () => {
    const { result, rerender } = render({
      session: "u\u0000g",
      total: 0,
      isReady: false,
      isOpen: false,
    });
    rerender({ session: "u\u0000g", total: 0, isReady: true, isOpen: false });

    rerender({ session: "u\u0000g", total: 2, isReady: true, isOpen: false });

    expect(result.current).toBe(2);
  });

  it("打开浮层即清零", () => {
    const { result, rerender } = render({
      session: "u\u0000g",
      total: 0,
      isReady: false,
      isOpen: false,
    });
    rerender({ session: "u\u0000g", total: 5, isReady: true, isOpen: false });
    rerender({ session: "u\u0000g", total: 8, isReady: true, isOpen: false });
    expect(result.current).toBe(3);

    rerender({ session: "u\u0000g", total: 8, isReady: true, isOpen: true });

    expect(result.current).toBe(0);
  });

  it("浮层开着时新到的消息也不算未读（正在看，不该再提示）", () => {
    const { result, rerender } = render({
      session: "u\u0000g",
      total: 2,
      isReady: false,
      isOpen: true,
    });
    rerender({ session: "u\u0000g", total: 2, isReady: true, isOpen: true });

    rerender({ session: "u\u0000g", total: 6, isReady: true, isOpen: true });

    expect(result.current).toBe(0);
  });

  it("关闭浮层后，再新到的消息重新计为未读", () => {
    const { result, rerender } = render({
      session: "u\u0000g",
      total: 0,
      isReady: false,
      isOpen: false,
    });
    rerender({ session: "u\u0000g", total: 2, isReady: true, isOpen: false });
    rerender({ session: "u\u0000g", total: 2, isReady: true, isOpen: true });
    rerender({ session: "u\u0000g", total: 2, isReady: true, isOpen: false });

    rerender({ session: "u\u0000g", total: 7, isReady: true, isOpen: false });

    expect(result.current).toBe(5);
  });

  it("切换会话会按新会话重建基线（旧会话的已看不会带过去）", () => {
    const { result, rerender } = render({
      session: "u\u0000g1",
      total: 0,
      isReady: false,
      isOpen: false,
    });
    rerender({ session: "u\u0000g1", total: 5, isReady: true, isOpen: false });
    rerender({ session: "u\u0000g1", total: 9, isReady: true, isOpen: false });
    expect(result.current).toBe(4);

    // 换了一个会话：新会话已有 20 条历史，不该算成 20 条未读
    rerender({ session: "u\u0000g2", total: 20, isReady: true, isOpen: false });

    expect(result.current).toBe(0);
  });

  it("基线跨挂载存活：换一屏（钩子卸载再挂载）期间到的新消息仍算未读", () => {
    const first = render({ session: "u\u0000g", total: 0, isReady: false, isOpen: false });
    first.rerender({ session: "u\u0000g", total: 5, isReady: true, isOpen: false });
    expect(first.result.current).toBe(0);
    first.unmount();

    // 另一屏挂载同一个会话：基线还是 5，新到的 2 条应显示为未读
    const second = render({ session: "u\u0000g", total: 7, isReady: false, isOpen: false });
    second.rerender({ session: "u\u0000g", total: 7, isReady: true, isOpen: false });

    expect(second.result.current).toBe(2);
  });
});
