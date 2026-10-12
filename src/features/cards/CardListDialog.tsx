import { useState } from "react";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CardDetailDialog from "./CardDetailDialog";
import CardItem from "./CardItem";
import type { Card } from "./types";

/**
 * 「某个角色的若干张卡」浮窗（只读）：牌组与战斗手牌共用，只在标题 / 空态文案上区分。
 *
 * 卡面紧凑三列；整卡点开三级 `CardDetailDialog`，点标记只弹 tooltip。**固定尺寸**（`size="cards"`）：
 * 宽三张、高三行，超出滚动，卡少也占同一块面积。`hideSource`（牌组）不显示来源，
 * `owner`（手牌）只在不是自己的牌时显示。
 */
export default function CardListDialog({
  title,
  actorName,
  cards,
  emptyText,
  hideSource = false,
  owner,
  onClose,
}: {
  /** 浮窗标题（「牌组」/「手牌」）。 */
  title: string;
  /** 角色原始名。 */
  actorName: string;
  cards: Card[];
  /** 空态文案（「（牌组为空）」/「（手牌为空）」）。 */
  emptyText: string;
  /** 一律不显示来源（牌组）。 */
  hideSource?: boolean;
  /** 持有者原始名：只在 `source !== owner` 时显示来源（手牌）。 */
  owner?: string;
  onClose: () => void;
}) {
  /** 三级浮窗正开着的卡；`null` 表示只在这层。 */
  const [openedCard, setOpenedCard] = useState<Card | null>(null);

  return (
    <>
      <Modal
        title={title}
        meta={`${displayName(actorName)} · 共 ${cards.length} 张`}
        size="cards"
        onClose={() => {
          // 三级开着时本层不响应关闭（ESC 一次只关一层）
          if (openedCard === null) {
            onClose();
          }
        }}
      >
        {cards.length === 0 ? (
          <p className="muted card-list-empty">{emptyText}</p>
        ) : (
          <ul className="card-tiles card-tiles--deck">
            {cards.map((card) => (
              <CardItem
                key={card.uuid}
                card={card}
                hideSource={hideSource}
                owner={owner}
                onSelect={setOpenedCard}
              />
            ))}
          </ul>
        )}
      </Modal>

      {openedCard === null ? null : (
        <CardDetailDialog
          card={openedCard}
          hideSource={hideSource}
          owner={owner}
          onClose={() => setOpenedCard(null)}
        />
      )}
    </>
  );
}
