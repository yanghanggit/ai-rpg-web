import Modal from "../../components/Modal";
import CardItem from "./CardItem";
import type { Card } from "./types";

/**
 * 卡牌详情浮窗：把一张卡的**完整信息**摊开（词缀是完整原文，不是紧凑卡面的 `[名称]`）。
 *
 * 牌组卡面为了「一行三张、所有行等高」只能给紧凑版（`CardItem` 的 `affixes="names"`），
 * 所以点卡再看全文这一层是必需的；奖励（Spoils）与战斗手牌本来就是完整卡面，不需要这一层。
 *
 * 内容用竖排（`card-tiles--stack`）：一次只看一张卡，纵向逐段读比并排更好。
 */
export default function CardDetailDialog({ card, onClose }: { card: Card; onClose: () => void }) {
  return (
    <Modal title="卡牌" meta={card.name} onClose={onClose}>
      <ul className="card-tiles card-tiles--stack">
        <CardItem card={card} />
      </ul>
    </Modal>
  );
}
