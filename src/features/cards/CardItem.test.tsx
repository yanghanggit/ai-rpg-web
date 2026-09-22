import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardItem from "./CardItem";
import type { Card } from "./types";

/**
 * `CardItem` 的单元测试：**卡面各部件用的是不是同一套设计语言**。
 *
 * 卡牌与角色卡各有一套语言（见 `CardItem` 顶部注释），所以这里盯的是卡牌这一套：
 * 词缀（三种时机）与布尔属性**都是带色 chip、都是一颗按钮**——点它弹说明浮层
 * （`CardMarkTip`），来源只在"不是自己的牌"时出现且标 `foreign`，`【塞牌】`不进卡面。
 */
const CARD: Card = {
  name: "钉棺",
  uuid: "c1",
  description: "（mock）抡起枣木钉，一钉一钉楔进棺盖的缝。",
  source: "",
  cost: 1,
  damage: 2,
  hit_count: 2,
  block: 0,
  target_type: "single",
  self_target: false,
  on_play_affixes: ["[破竹]:本段命中后更容易击穿格挡"],
  on_hit_affixes: ["[入木]:命中的段数越多，棺盖越难再开"],
  on_turn_end_affixes: ["[余音]:回合结束时余音未散"],
  exhaust: true,
  retain: true,
  ethereal: true,
  transferable: true,
  playable: true,
};

describe("CardItem", () => {
  it("词缀与布尔属性都渲染成带色 chip", () => {
    render(
      <ul>
        <CardItem card={CARD} />
      </ul>,
    );

    // 四种布尔标记各一色
    expect(screen.getByText("消耗牌")).toHaveClass("affix-chip--exhaust");
    expect(screen.getByText("保留")).toHaveClass("affix-chip--retain");
    expect(screen.getByText("虚无")).toHaveClass("affix-chip--ethereal");
    expect(screen.getByText("可传递")).toHaveClass("affix-chip--transfer");
    // 三种时机词缀各一色（卡面只写 [名称]）
    expect(screen.getByText("[破竹]")).toHaveClass("affix-chip--play");
    expect(screen.getByText("[入木]")).toHaveClass("affix-chip--hit");
    expect(screen.getByText("[余音]")).toHaveClass("affix-chip--turn-end");
  });

  it("playable === false 才标「不可出牌」，卡面永远不出现【塞牌】", () => {
    render(
      <ul>
        <CardItem card={{ ...CARD, playable: false }} />
      </ul>,
    );

    expect(screen.getByText("不可出牌")).toHaveClass("affix-chip--unplayable");
    // 【塞牌】是"牌与持有者的关系"，只挂在 ActorCard 一侧，不进卡面
    expect(screen.queryByText("[塞牌]")).not.toBeInTheDocument();
  });

  it("来源只在「不是自己的牌」时显示，并标 foreign", () => {
    const { rerender } = render(
      <ul>
        <CardItem card={{ ...CARD, source: "角色.无名" }} owner="角色.无名" />
      </ul>,
    );
    // 持有者就是来源：不显示
    expect(screen.queryByText(/来源：/)).not.toBeInTheDocument();

    rerender(
      <ul>
        <CardItem card={{ ...CARD, source: "角色.无名" }} owner="怪物.纸人" />
      </ul>,
    );
    expect(screen.getByText("来源：角色.无名")).toHaveClass("card-tile-source--foreign");
  });

  it("点任意一枚标记（布尔或词缀）都弹说明浮层；再点同一枚收起", () => {
    render(
      <ul>
        <CardItem card={CARD} />
      </ul>,
    );

    // 布尔标记：说明是前端自带的那一句话
    fireEvent.click(screen.getByRole("button", { name: "保留" }));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("回合结束时留在手牌，不进入弃牌堆。");
    // 浮层同时标出分类与名称（与卡面、详情右栏用的是同一对 chip）
    expect(tip).toHaveTextContent("标记");
    expect(tip).toHaveTextContent("保留");

    // 词缀：说明就是它自己那段原文
    fireEvent.click(screen.getByRole("button", { name: "[入木]" }));
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip")).toHaveTextContent("命中的段数越多，棺盖越难再开");

    // 再点同一枚 → 收起
    fireEvent.click(screen.getByRole("button", { name: "[入木]" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("说明浮层：点外部 / 按 ESC 都会关", () => {
    render(
      <ul>
        <CardItem card={CARD} />
      </ul>,
    );

    fireEvent.click(screen.getByRole("button", { name: "保留" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    // 点浮层外面（`mousedown` 早于 click，所以不会跟"点另一枚 chip"抢）
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保留" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("传了 onMarkClick 就交给调用方（详情左栏用它定位右栏，不再弹浮层）", () => {
    const picked: string[] = [];
    render(
      <ul>
        <CardItem card={CARD} onMarkClick={(mark) => picked.push(mark.id)} />
      </ul>,
    );

    fireEvent.click(screen.getByRole("button", { name: "[入木]" }));
    expect(picked).toEqual(["on_hit_affixes:[入木]:命中的段数越多，棺盖越难再开"]);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
