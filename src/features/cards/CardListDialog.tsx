import type { ReactNode } from "react";
import { useState } from "react";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CardDetailDialog from "./CardDetailDialog";
import CardItem from "./CardItem";
import type { Card } from "./types";

/**
 * 「某个角色的若干张卡」浮窗（只读）：**牌组与战斗手牌共用**。
 *
 * 牌组与手牌本质是同一个东西的两种来源（一个人的一组牌），所以只在 `title` / 空态文案上区分，
 * 渲染逻辑一份——否则同一张卡在两个浮窗里迟早会长得不一样。
 *
 * 卡面是**紧凑版**：一行最多三张、所有行严格等高（`.card-tiles--deck`），词缀只给 `[名称]`；
 * 点某张卡再叠出**三级** `CardDetailDialog` 看完整信息（词缀全文）。三级开着时本层的关闭
 * （含 ESC）不响应，避免一次 ESC 连关两层。
 *
 * 面板宽度用 `Modal` 的 `size="fit"` 随卡数收缩（1 张 ~240px、3 张 ~670px），卡少也不留一片空；
 * 列数由 `card-tiles--deck-N`（N = min(卡数, 3)）给出，网格才能算得准内容宽度。
 */
export default function CardListDialog({
  title,
  actorName,
  cards,
  emptyText,
  cardBadge,
  onClose,
}: {
  /** 浮窗标题（「牌组」/「手牌」）。 */
  title: string;
  /** 角色原始名。 */
  actorName: string;
  cards: Card[];
  /** 空态文案（「（牌组为空）」/「（手牌为空）」）。 */
  emptyText: string;
  /** 给单张卡额外挂一枚标记（如手牌里的【塞牌】）；不给就不挂。 */
  cardBadge?: (card: Card) => ReactNode;
  onClose: () => void;
}) {
  /** 三级浮窗正开着的卡；`null` 表示只在这层。 */
  const [openedCard, setOpenedCard] = useState<Card | null>(null);

  return (
    <>
      <Modal
        title={title}
        meta={`${displayName(actorName)} · 共 ${cards.length} 张`}
        size="fit"
        onClose={() => {
          // 三级开着时本层不响应关闭（ESC 一次只关一层）
          if (openedCard === null) {
            onClose();
          }
        }}
      >
        {cards.length === 0 ? (
          <p className="muted">{emptyText}</p>
        ) : (
          <ul
            className={`card-tiles card-tiles--deck card-tiles--deck-${Math.min(cards.length, 3)}`}
          >
            {cards.map((card) => (
              <CardItem
                key={card.uuid}
                card={card}
                affixes="names"
                badge={cardBadge?.(card)}
                onSelect={setOpenedCard}
              />
            ))}
          </ul>
        )}
      </Modal>

      {openedCard !== null ? (
        <CardDetailDialog card={openedCard} onClose={() => setOpenedCard(null)} />
      ) : null}
    </>
  );
}
