import { useState } from "react";
import { displayName } from "../../../components/displayName";
import Modal from "../../../components/Modal";
import CardDetailDialog from "../../cards/CardDetailDialog";
import CardItem from "../../cards/CardItem";
import type { Card } from "../../cards/types";

/**
 * 某个队伍成员的奖励（Spoils）浮窗：**竖排**候选卡，每张一个「挑选」。
 *
 * 奖励是当场要做的决策，但不再摊在页面上——角色卡上只留一个「奖励」按钮，点开才展开，
 * 与「先看到角色、再看到奖励卡」的渐进式流程一致。
 *
 * 领卡**按成员各自算**：「领过一次」后不再给「挑选」按钮（后端当前也只允许领一张），
 * 并分别列出已领取与待领取候选供回看（组件本身由页面作为「已生成」守卫保留）。
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
  /** 领卡任务在跑时为 true：禁用所有「挑选」（同一条后端管道一次只放一个）。 */
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
      {hasClaimed ? <p className="muted">（已领取，以下为本次候选，仅供参考）</p> : null}
      {error ? <p className="error">领卡失败：{error}</p> : null}

      {hasClaimed ? (
        <>
          <p className="muted">已领取 {claimedCards.length} 张：</p>
          <ul className="card-tiles card-tiles--stack">
            {claimedCards.map((card) => (
              <CardItem
                key={card.uuid}
                card={card}
                affixes="names"
                action={null}
                claimed
                onSelect={setOpenedCard}
              />
            ))}
          </ul>
          <p className="muted">待领取候选 {candidateCards.length} 张：</p>
        </>
      ) : null}

      <ul className="card-tiles card-tiles--stack">
        {candidateCards.map((card) => (
          <CardItem
            key={card.uuid}
            card={card}
            affixes="names"
            onSelect={setOpenedCard}
            action={
              hasClaimed ? null : (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`挑选 ${card.name}`}
                  onClick={() => onPick(card.name)}
                >
                  挑选
                </button>
              )
            }
          />
        ))}
      </ul>

      {openedCard !== null ? (
        <CardDetailDialog card={openedCard} onClose={() => setOpenedCard(null)} />
      ) : null}
    </Modal>
  );
}
