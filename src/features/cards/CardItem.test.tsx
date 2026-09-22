import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardItem from "./CardItem";
import type { Card } from "./types";

/**
 * `CardItem` 的单元测试：**卡面各部件用的是不是同一套设计语言**。
 *
 * 卡牌与角色卡各有一套语言（见 `CardItem` 顶部注释），所以这里盯的是卡牌这一套：
 * 布尔属性（消耗 / 保留 / 虚无 / 可传递 / 不可出牌）与三种时机的词缀**都是带色 chip**，
 * 来源只在"不是自己的牌"时出现且标 `foreign`，`【塞牌】`这种"持有关系"不进卡面。
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
  it("布尔属性与三种时机的词缀都渲染成带色 chip", () => {
    render(
      <ul>
        <CardItem card={CARD} affixes="names" />
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
        <CardItem card={{ ...CARD, playable: false }} affixes="names" />
      </ul>,
    );

    expect(screen.getByText("不可出牌")).toHaveClass("affix-chip--unplayable");
    // 【塞牌】是"牌与持有者的关系"，只挂在 ActorCard 一侧，不进卡面
    expect(screen.queryByText("[塞牌]")).not.toBeInTheDocument();
  });

  it("来源只在「不是自己的牌」时显示，并标 foreign", () => {
    const { rerender } = render(
      <ul>
        <CardItem card={{ ...CARD, source: "角色.无名" }} affixes="names" owner="角色.无名" />
      </ul>,
    );
    // 持有者就是来源：不显示
    expect(screen.queryByText(/来源：/)).not.toBeInTheDocument();

    rerender(
      <ul>
        <CardItem card={{ ...CARD, source: "角色.无名" }} affixes="names" owner="怪物.纸人" />
      </ul>,
    );
    expect(screen.getByText("来源：角色.无名")).toHaveClass("card-tile-source--foreign");
  });

  it("详情（full）写词缀全文，卡面（names）只写 [名称]", () => {
    const { rerender } = render(
      <ul>
        <CardItem card={CARD} affixes="names" />
      </ul>,
    );
    expect(screen.queryByText(/命中的段数越多/)).not.toBeInTheDocument();

    rerender(
      <ul>
        <CardItem card={CARD} affixes="full" />
      </ul>,
    );
    expect(screen.getByText(/命中的段数越多/)).toBeInTheDocument();
  });
});
