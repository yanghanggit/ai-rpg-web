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
 * 卡面是**紧凑版**：一行最多三张、所有行严格等高（`.card-tiles--deck`），词缀只给 `[名称]` 标记
 * （点标记或整张卡都叠出**三级** `CardDetailDialog` 看完整信息）。三级开着时本层的关闭
 * （含 ESC）不响应，避免一次 ESC 连关两层。
 *
 * **点词缀 vs 点整卡**：两者都开三级，但点词缀会把**那一条词缀**一并带过去——详情右栏一打开就
 * 高亮它（见 `CardDetailDialog` 的两栏联动）。
 *
 * **来源显示**：牌组（`hideSource`）一律不显示（牌必属持有者）；手牌（`owner`）只在不是自己的牌
 * （【塞牌】）时才显示来源。
 *
 * 面板宽度用 `Modal` 的 `size="fit"` 随卡数收缩（1 张 ~240px、3 张 ~670px），卡少也不留一片空；
 * 列数由 `card-tiles--deck-N`（N = min(卡数, 3)）给出，网格才能算得准内容宽度。
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
  /** 三级浮窗正开着的卡；`null` 表示只在这层。`affix` 是从哪枚词缀点进来的（没有就是整卡点开）。 */
  const [openedCard, setOpenedCard] = useState<{ card: Card; affix: string | null } | null>(null);

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
                hideSource={hideSource}
                owner={owner}
                onSelect={(card) => setOpenedCard({ card, affix: null })}
                onAffixClick={(card, affix) => setOpenedCard({ card, affix })}
              />
            ))}
          </ul>
        )}
      </Modal>

      {openedCard === null ? null : (
        <CardDetailDialog
          card={openedCard.card}
          initialAffix={openedCard.affix}
          hideSource={hideSource}
          owner={owner}
          onClose={() => setOpenedCard(null)}
        />
      )}
    </>
  );
}
