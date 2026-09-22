import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardDetailDialog from "./CardDetailDialog";
import type { Card } from "./types";

/**
 * `CardDetailDialog` 的测试：**两栏分工 + 两栏联动**。
 *
 * 左栏是卡牌原样（词缀缩略成 `[名称]`），右栏是完整信息（说明全文 + **每一枚标记**逐条全文，
 * 布尔与时机词缀分节）；点左栏某枚标记 → 右栏对应那条被选中，且**不弹 tooltip**
 * （右栏已经把全文写在眼前，再弹一层是重复信息）。
 */
const CARD: Card = {
  name: "钉棺",
  uuid: "c1",
  description: "（mock）抡起枣木钉，一钉一钉楔进棺盖的缝——这句话在卡面上是放不下的。",
  source: "角色.无名",
  cost: 1,
  damage: 2,
  hit_count: 2,
  block: 0,
  target_type: "single",
  self_target: false,
  on_play_affixes: ["[破竹]:本段命中后更容易击穿格挡"],
  on_hit_affixes: ["[入木]:命中的段数越多，棺盖越难再开"],
  on_turn_end_affixes: [],
  exhaust: false,
  retain: false,
  ethereal: false,
  transferable: true,
  playable: false,
};

const face = () => screen.getByRole("list", { name: "卡面" });
const section = (name: string) => screen.getByRole("region", { name });
const rowsOf = (name: string) => within(section(name)).getAllByRole("listitem");
/** 某节里第 `index` 条（越界就抛错，免得测试因为 `undefined` 而静默放过）。 */
function row(name: string, index: number): HTMLElement {
  const found = rowsOf(name)[index];
  if (found === undefined) {
    throw new Error(`「${name}」节里没有第 ${index} 条`);
  }
  return found;
}

describe("CardDetailDialog", () => {
  it("两栏：左栏是卡原样（词缀缩略），右栏按节列出每一枚标记的全文", () => {
    render(<CardDetailDialog card={CARD} onClose={() => {}} />);

    // 左栏 = 那张卡：词缀只写 `[名称]`，说明全文不在这里
    expect(within(face()).getByText("[破竹]")).toBeInTheDocument();
    expect(within(face()).queryByText(/本段命中后更容易击穿格挡/)).not.toBeInTheDocument();
    // 叙述也不在卡面上（卡面只剩名字 / 数值 / 标记），全文只在右栏
    expect(within(face()).queryByText(/这句话在卡面上是放不下的/)).not.toBeInTheDocument();

    // 右栏 = 完整信息：说明全文
    expect(section("说明")).toHaveTextContent(/这句话在卡面上是放不下的/);

    // 布尔标记单独一节：只列"开了"的那些（playable=false → 不可出牌；可传递 → transferable）
    expect(rowsOf("标记")).toHaveLength(2);
    expect(within(row("标记", 0)).getByText("不可出牌")).toBeInTheDocument();
    expect(
      within(row("标记", 0)).getByText("系统会拦住这张牌：不能主动打出。"),
    ).toBeInTheDocument();

    // 时机词缀按分节标题分节（这里是"打出时"），每条写全文
    expect(within(row("打出时", 0)).getByText(/本段命中后更容易击穿格挡/)).toBeInTheDocument();
    expect(within(row("被命中时", 0)).getByText(/命中的段数越多/)).toBeInTheDocument();
  });

  it("点左栏某枚标记 → 右栏对应那条被选中（不弹 tooltip）；再点一次取消", () => {
    render(<CardDetailDialog card={CARD} onClose={() => {}} />);

    expect(row("标记", 0)).not.toHaveClass("card-detail-mark--active");

    fireEvent.click(within(face()).getByRole("button", { name: "不可出牌" }));
    expect(row("标记", 0)).toHaveClass("card-detail-mark--active");
    // 右栏已把全文写在眼前，所以这里不再弹说明浮层
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(within(face()).getByRole("button", { name: "不可出牌" }));
    expect(row("标记", 0)).not.toHaveClass("card-detail-mark--active");
  });

  it("选中态只落在一枚标记上（点词缀不会连带选中布尔那一条）", () => {
    render(<CardDetailDialog card={CARD} onClose={() => {}} />);

    fireEvent.click(within(face()).getByRole("button", { name: "[入木]" }));
    expect(row("被命中时", 0)).toHaveClass("card-detail-mark--active");
    expect(row("标记", 0)).not.toHaveClass("card-detail-mark--active");
  });
});
