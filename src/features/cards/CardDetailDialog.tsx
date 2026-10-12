import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import CardItem from "./CardItem";
import { type CardMark, readCardMarks } from "./cardMarks";
import type { Card } from "./types";

/**
 * 卡牌详情浮窗（三级）：左栏「这张卡原样」（复用 `CardItem`），右栏「完整信息」（说明全文 +
 * 每枚标记逐条展开，分节顺序即 `readCardMarks`）。
 *
 * 两栏联动：点左栏某枚标记 → 右栏对应那条高亮并滚入视野，再点取消。这里不弹 tooltip（全文已在右栏）。
 */
export default function CardDetailDialog({
  card,
  hideSource = false,
  owner,
  onClose,
}: {
  card: Card;
  /** 与卡面同一口径：牌组不显示来源。 */
  hideSource?: boolean;
  /** 持有者原始名：`source !== owner` 时才显示来源（与卡面同一口径）。 */
  owner?: string;
  onClose: () => void;
}) {
  // 右栏当前选中的那枚标记（`CardMark.id`）；点同一枚再来一次就取消
  const [activeId, setActiveId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const marks = readCardMarks(card);
  // 按 `group` 分节，顺序沿用 `readCardMarks`
  const sections: { group: string; marks: CardMark[] }[] = [];
  for (const mark of marks) {
    const last = sections[sections.length - 1];
    if (last !== undefined && last.group === mark.group) {
      last.marks.push(mark);
    } else {
      sections.push({ group: mark.group, marks: [mark] });
    }
  }

  // 右栏长了以后，点左栏得能滚到那一条
  useEffect(() => {
    if (activeId !== null) {
      rowRefs.current.get(activeId)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeId]);

  return (
    <Modal title="卡牌" meta={card.name} onClose={onClose}>
      <div className="card-detail">
        {/* 左栏：这张卡原样；点标记 chip 定位右栏对应那条 */}
        <ul className="card-tiles card-detail-card" aria-label="卡面">
          <CardItem
            card={card}
            hideSource={hideSource}
            owner={owner}
            onMarkClick={(mark) => setActiveId((current) => (current === mark.id ? null : mark.id))}
          />
        </ul>

        {/* 右栏：完整信息——说明全文 + 每一枚标记的全文 */}
        <div className="card-detail-body">
          {card.description === "" ? null : (
            <section className="card-detail-section" aria-label="说明">
              <h3 className="card-detail-heading">说明</h3>
              <p className="card-detail-desc">{card.description}</p>
            </section>
          )}

          {sections.map(({ group, marks: groupMarks }) => (
            <section key={group} className="card-detail-section" aria-label={group}>
              {/* 分节标题已写明分类，每行只留名称 chip */}
              <h3 className="card-detail-heading">{group}</h3>
              <ul className="card-detail-marks">
                {groupMarks.map((mark) => (
                  <li
                    key={mark.id}
                    ref={(node) => {
                      if (node === null) {
                        rowRefs.current.delete(mark.id);
                      } else {
                        rowRefs.current.set(mark.id, node);
                      }
                    }}
                    className={`card-detail-mark card-detail-mark--${mark.tone}${
                      mark.id === activeId ? " card-detail-mark--active" : ""
                    }`}
                  >
                    <span className={`affix-chip affix-chip--${mark.tone}`}>{mark.label}</span>
                    <span className="card-detail-mark-text">{mark.hint}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
