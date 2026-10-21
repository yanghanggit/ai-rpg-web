import { useState } from "react";
import { displayName } from "../../../components/displayName";
import Modal from "../../../components/Modal";
import CardDetailDialog from "../../cards/CardDetailDialog";
import type { Card } from "../../cards/types";

/**
 * 奖励类型徽标的唯一真值来源：**奖励队列**（后端 `SpoilsComponent` 按类型分队列）。
 * 现在只有 `candidate_cards`，所以恒为「卡牌」；加 `candidate_items` 等队列时在这里补一行。
 */
const QUEUE_LABELS: Record<string, string> = {
  cards: "卡牌",
};

/** 某个成员的奖励浮窗（一人一窗）：**一级是名字列表**，一行一份奖励。
 *
 * 行 = 名字（点开 `CardDetailDialog`）+ 类型徽标 + 行尾「拾取」。类型徽标取自**奖励队列**
 * （`QUEUE_LABELS`）——`Card` 没有类型字段。领卡按成员各自算：领过一张后不再给「拾取」，
 * 已领取另起一段供回看。为什么一级不用卡面：见 docs/pages.md「奖励浮窗」。
 */
export default function SpoilsDialog({
  memberName,
  spoils,
  busy,
  error,
  onPick,
  onClose,
}: {
  /** 角色原始名（标题副标题显示用）。 */
  memberName: string;
  /** 该成员的奖励：待领取候选 + 已领取两个队列。 */
  spoils: { candidateCards: Card[]; claimedCards: Card[] };
  /** 领卡任务在跑时为 true：禁用所有「拾取」（同一条后端管道一次只放一个）。 */
  busy: boolean;
  /** 领卡失败的原因（展示在浮窗内，不落到页面动作区）。 */
  error: string | null;
  onPick: (cardName: string) => void;
  onClose: () => void;
}) {
  const { candidateCards, claimedCards } = spoils;
  const hasClaimed = claimedCards.length > 0;
  /** 二级浮窗正开着的卡；`null` 表示只在这层。 */
  const [openedCard, setOpenedCard] = useState<Card | null>(null);

  /** 一行奖励：名字（开细节）+ 类型徽标 +（未领取时）行尾的「拾取」。 */
  function row(card: Card, pickable: boolean) {
    return (
      <li key={card.uuid}>
        <button
          type="button"
          className="spoils-row"
          aria-label={`查看奖励：${card.name}`}
          title="看这张奖励的细节"
          onClick={() => setOpenedCard(card)}
        >
          <span>{card.name}</span>
          <span className="badge">{QUEUE_LABELS.cards}</span>
        </button>
        {/* 不能领的行（已领取 / 本成员已领过一张）右边什么都不放：
            含义由所在的分段标题给，逐行再写一遍只会把"候选"也标成"已领取" */}
        {pickable ? (
          <button
            type="button"
            className="spoils-pick"
            disabled={busy}
            aria-label={`拾取 ${card.name}`}
            onClick={() => onPick(card.name)}
          >
            拾取
          </button>
        ) : null}
      </li>
    );
  }

  return (
    <Modal
      title="奖励"
      meta={`${displayName(memberName)} · 候选 ${candidateCards.length} 张`}
      onClose={() => {
        // 卡牌详情开着时本层不响应关闭（ESC 一次只关一层）
        if (openedCard === null) {
          onClose();
        }
      }}
    >
      {error ? <p className="error">领卡失败：{error}</p> : null}

      {hasClaimed ? (
        <>
          <h3>已领取 {claimedCards.length} 张</h3>
          <ul className="action-list spoils-list">
            {claimedCards.map((card) => row(card, false))}
          </ul>
          <h3>待领取候选 {candidateCards.length} 张</h3>
        </>
      ) : null}

      {candidateCards.length === 0 ? (
        <p className="muted">（没有待领取的候选）</p>
      ) : (
        <ul className="action-list spoils-list">
          {candidateCards.map((card) => row(card, !hasClaimed))}
        </ul>
      )}

      {openedCard === null ? null : (
        <CardDetailDialog card={openedCard} onClose={() => setOpenedCard(null)} />
      )}
    </Modal>
  );
}
