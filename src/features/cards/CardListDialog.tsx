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
 * 卡面是**紧凑版**：三列、行高一致（`.card-tiles--deck`）。**整张卡点开三级**
 * `CardDetailDialog`（左栏卡面 / 右栏逐条展开）；**点标记 chip 只弹 tooltip**说明那一枚
 * （`CardItem` 自带；详情里才改成定位右栏那一条）。三级开着时本层的关闭（含 ESC）不响应，
 * 避免一次 ESC 连关两层。
 *
 * **来源显示**：牌组（`hideSource`）一律不显示（牌必属持有者）；手牌（`owner`）只在不是自己的牌
 * （【塞牌】）时才显示来源。
 *
 * **固定尺寸，不跟着卡数走**（`Modal` 的 `size="cards"`）：宽正好三张卡、高正好三行
 * （`--card-list-w` / `--card-list-h`），多出来的在框内滚动。卡少（甚至一张没有）也占住同一块
 * 面积——否则牌组 / 手牌 / 牌堆三个浮窗会一个比一个窄，每次打开都要重新找位置。
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
