import { useState } from "react";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CardDetailDialog from "../cards/CardDetailDialog";
import CardItem from "../cards/CardItem";
import type { Card } from "../cards/types";

/**
 * 某个队伍成员的牌组浮窗（只读）。
 *
 * 卡面是**紧凑版**：一行最多三张、所有行严格等高（`.card-tiles--deck`），词缀只给 `[名称]`；
 * 点某张卡再叠出**三级** `CardDetailDialog` 看完整信息（词缀全文）。三级开着时本层的「关闭」
 * （含 ESC）不响应，避免一次 ESC 连关两层。
 *
 * 面板宽度用 `Modal` 的 `size="fit"` 随卡数收缩（1 张 ~240px、3 张 ~670px），卡少也不留一片空；
 * 列数由 `card-tiles--deck-N`（N = min(卡数, 3)）给出，网格才能算得准内容宽度。
 *
 * 入口只有一个：副本进行中标题行的「牌组」（`DeckBrowserDialog` 的一级名单 → 本浮窗是二级）。
 * 牌组会长（初始就有、挑卡后再加），所以不摊在页面上，点名单里某一行才展开；
 * 奖励（Spoils）只有 3 张候选，是当场的决策对象，所以留在页面上（开场房间的角色卡上）。
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
  /** 三级浮窗正开着的卡；`null` 表示只看牌组。 */
  const [openedCard, setOpenedCard] = useState<Card | null>(null);

  return (
    <>
      <Modal
        title="牌组"
        meta={`${displayName(memberName)} · 共 ${cards.length} 张`}
        size="fit"
        onClose={() => {
          // 三级开着时本层不响应关闭（ESC 一次只关一层）
          if (openedCard === null) {
            onClose();
          }
        }}
      >
        {cards.length === 0 ? (
          <p className="muted">（牌组为空）</p>
        ) : (
          <ul
            className={`card-tiles card-tiles--deck card-tiles--deck-${Math.min(cards.length, 3)}`}
          >
            {cards.map((card) => (
              <CardItem key={card.uuid} card={card} affixes="names" onSelect={setOpenedCard} />
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
