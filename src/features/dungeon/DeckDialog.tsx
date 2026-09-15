import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CardItem from "../cards/CardItem";
import type { Card } from "../cards/types";

/**
 * 某个队伍成员的牌组浮窗（只读）。
 *
 * 牌组会长（初始就有、挑卡后再加），所以不摊在页面上，点「查看牌组」才展开；
 * 卡池只有 3 张候选，是当场的决策对象，所以留在页面上。
 */
export default function DeckDialog({
  memberName,
  cards,
  onClose,
}: {
  /** 角色原始名。 */
  memberName: string;
  cards: Card[];
  onClose: () => void;
}) {
  return (
    <Modal
      title="牌组"
      meta={`${displayName(memberName)} · 共 ${cards.length} 张`}
      onClose={onClose}
    >
      {cards.length === 0 ? (
        <p className="muted">（牌组为空）</p>
      ) : (
        <ul className="card-tiles">
          {cards.map((card) => (
            <CardItem key={card.uuid} card={card} />
          ))}
        </ul>
      )}
    </Modal>
  );
}
