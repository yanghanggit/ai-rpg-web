import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Item } from "../../items/types";
import LootDialog from "./LootDialog";

/** `LootComponent.items` 契约上是 `AnyItem`（服务端四种道具联合），每种各来一件。 */
const loot: Item[] = [
  { name: "材料.腐化兽骨", uuid: "loot-1", type: "MaterialItem", description: "兽骨。", count: 2 },
  { name: "装备.旧铁剑", uuid: "loot-2", type: "GearItem", description: "旧剑。", count: 1 },
  {
    name: "消耗品.治疗药水",
    uuid: "loot-3",
    type: "ConsumableItem",
    description: "药水。",
    count: 3,
  },
  { name: "时装.旅人斗篷", uuid: "loot-4", type: "CostumeItem", description: "斗篷。", count: 1 },
];

describe("战斗战利品浮窗", () => {
  it("把 LootComponent.items 全列出来，四种道具类型都认（名字 / 数量 / 中文类型）", () => {
    render(
      <LootDialog loot={loot} busy={false} error={null} onCollect={() => {}} onClose={() => {}} />,
    );

    expect(screen.getByText("腐化兽骨 ×2")).toBeInTheDocument();
    expect(screen.getByText("旧铁剑")).toBeInTheDocument();
    expect(screen.getByText("治疗药水 ×3")).toBeInTheDocument();
    expect(screen.getByText("旅人斗篷")).toBeInTheDocument();
    expect(screen.getByText("材料")).toBeInTheDocument();
    expect(screen.getByText("装备")).toBeInTheDocument();
    expect(screen.getByText("消耗品")).toBeInTheDocument();
    expect(screen.getByText("时装")).toBeInTheDocument();
  });

  it("「收取全部」调 onCollect；busy 时禁用并显示收取中", () => {
    const onCollect = vi.fn();
    const { rerender } = render(
      <LootDialog loot={loot} busy={false} error={null} onCollect={onCollect} onClose={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "收取全部（4）" }));
    expect(onCollect).toHaveBeenCalledTimes(1);

    rerender(<LootDialog loot={loot} busy error={null} onCollect={onCollect} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "收取中…" })).toBeDisabled();
  });

  it("收取失败时在浮窗内显示原因", () => {
    render(
      <LootDialog
        loot={loot}
        busy={false}
        error="（mock）失败"
        onCollect={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("收取战利品失败：（mock）失败")).toBeInTheDocument();
  });
});
