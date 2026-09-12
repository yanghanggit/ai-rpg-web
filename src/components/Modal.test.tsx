import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

function renderModal(onClose = vi.fn()) {
  render(
    <Modal title="标题" meta="共 3 条" onClose={onClose}>
      <p>内容</p>
    </Modal>,
  );
  return onClose;
}

describe("Modal", () => {
  it("渲染标题、补充信息与内容，并把焦点移到关闭按钮", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("共 3 条")).toBeInTheDocument();
    expect(screen.getByText("内容")).toBeInTheDocument();
    // 键盘用户直接落在关闭按钮上，不必先 Tab 穿过后面的整页
    expect(screen.getByRole("button", { name: "关闭" })).toHaveFocus();
  });

  it("ESC、遮罩、关闭按钮三条路径都能关闭", () => {
    const onClose = renderModal();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "关闭浮层" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("打开期间锁住背景滚动，卸载后还原", () => {
    const { unmount } = render(
      <Modal title="标题" onClose={() => {}}>
        <p>内容</p>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
