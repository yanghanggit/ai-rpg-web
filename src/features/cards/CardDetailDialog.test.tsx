import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardDetailDialog from "./CardDetailDialog";
import type { Card } from "./types";

/**
 * `CardDetailDialog` 的测试：**两栏分工 + 两栏联动**。
 *
 * 左栏是卡牌原样（词缀缩略成 `[名称]`），右栏是完整信息（说明全文 + 三种时机的词缀逐条全文）；
 * 点左栏某枚词缀 → 右栏对应那一条被标记为选中。
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
  playable: true,
};

const face = () => screen.getByRole("list", { name: "卡面" });
const affixRows = () =>
  within(screen.getByRole("region", { name: "词缀" })).getAllByRole("listitem");
/** 第 `index` 条词缀（越界就抛错，免得测试因为 `undefined` 而静默放过）。 */
function affixRow(index: number): HTMLElement {
  const row = affixRows()[index];
  if (row === undefined) {
    throw new Error(`右栏没有第 ${index} 条词缀`);
  }
  return row;
}

describe("CardDetailDialog", () => {
  it("两栏：左栏是卡原样（词缀缩略），右栏是完整信息（说明全文 + 词缀逐条全文）", () => {
    render(<CardDetailDialog card={CARD} onClose={() => {}} />);

    // 左栏 = 那张卡：词缀只写 `[名称]`，说明全文不在这里
    expect(within(face()).getByText("[破竹]")).toBeInTheDocument();
    expect(within(face()).queryByText(/本段命中后更容易击穿格挡/)).not.toBeInTheDocument();

    // 右栏 = 完整信息：时机标签 + `[名称]` + 说明全文
    expect(screen.getByRole("region", { name: "说明" })).toHaveTextContent(
      /这句话在卡面上是放不下的/,
    );
    const rows = affixRows();
    expect(rows).toHaveLength(2);
    expect(within(affixRow(0)).getByText("打出时")).toBeInTheDocument();
    expect(within(affixRow(0)).getByText(/本段命中后更容易击穿格挡/)).toBeInTheDocument();
    expect(within(affixRow(1)).getByText("被命中时")).toBeInTheDocument();
    expect(within(affixRow(1)).getByText(/命中的段数越多/)).toBeInTheDocument();
  });

  it("点左栏某枚词缀 → 右栏对应那条被选中；再点一次取消", () => {
    render(<CardDetailDialog card={CARD} onClose={() => {}} />);

    // 只有左栏的词缀是按钮（右栏是只读的全文）
    const chip = within(face()).getByRole("button", { name: "[入木]" });
    expect(affixRow(1)).not.toHaveClass("card-detail-affix--active");

    fireEvent.click(chip);
    expect(affixRow(1)).toHaveClass("card-detail-affix--active");
    expect(affixRow(0)).not.toHaveClass("card-detail-affix--active");

    fireEvent.click(chip);
    expect(affixRow(1)).not.toHaveClass("card-detail-affix--active");
  });

  it("从某枚词缀点进来的：右栏那一条一打开就是选中态", () => {
    render(
      <CardDetailDialog
        card={CARD}
        initialAffix="[入木]:命中的段数越多，棺盖越难再开"
        onClose={() => {}}
      />,
    );

    expect(affixRow(1)).toHaveClass("card-detail-affix--active");
    expect(affixRow(0)).not.toHaveClass("card-detail-affix--active");
  });
});
