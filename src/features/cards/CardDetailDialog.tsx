import { useState } from "react";
import Modal from "../../components/Modal";
import CardItem, { AFFIX_TYPES } from "./CardItem";
import { readAffixParts } from "./readAffixLabel";
import type { Card } from "./types";

/**
 * 卡牌详情浮窗（三级）：**两栏**——左边是「这张卡原样长什么样」，右边是「完整信息」。
 *
 * 紧凑卡面（`affixes="names"`）为了「一行几张、所有行等高」只能把词缀压成 `[名称]`，也没有
 * 让长文本展开的地方；所以点开这一层后：
 * - **左栏**：直接复用 `CardItem`（同样是 `names` 颗粒度），是"这张卡在别处长什么样"的
 *   **字面复刻**——是什么就显示什么，词缀依旧缩略；
 * - **右栏**：`description` 全文（卡面可能放不下）+ 三种时机的词缀**逐条**列全文
 *   （`readAffixParts` 拆成 `[名称]` + 说明两段；解析不出名称时不猜，整条当说明）。
 *
 * **两栏联动**：点左栏任一词缀 chip → 右栏对应那一条标记为选中（左侧一条竖线 + 淡底），
 * 再点一次取消；从某枚词缀点进来的（`initialAffix`）一打开就是选中态。
 *
 * 两栏都从顶部对齐（`align-items: start`）：右栏比卡长时只往下长，卡不跟着被拉高。
 */
export default function CardDetailDialog({
  card,
  initialAffix = null,
  hideSource = false,
  owner,
  onClose,
}: {
  card: Card;
  /** 从某枚词缀点进来时那条词缀的原文：右栏对应条目一打开就选中。 */
  initialAffix?: string | null;
  /** 与卡面同一口径：牌组不显示来源。 */
  hideSource?: boolean;
  /** 持有者原始名：`source !== owner` 时才显示来源（与卡面同一口径）。 */
  owner?: string;
  onClose: () => void;
}) {
  // 右栏当前选中的词缀原文；点同一枚再来一次就取消
  const [activeAffix, setActiveAffix] = useState<string | null>(initialAffix);

  // 三种时机的词缀摊平成一条条（顺序 = 打出时 → 被命中时 → 回合结束时）
  const affixes = AFFIX_TYPES.flatMap(({ key, label, tone }) =>
    card[key].map((affix) => ({ key, label, tone, affix })),
  );

  return (
    <Modal title="卡牌" meta={card.name} onClose={onClose}>
      <div className="card-detail">
        {/* 左栏：这张卡原样（紧凑卡面）。词缀 chip 是按钮，点一下联动右栏 */}
        <ul className="card-tiles card-detail-card" aria-label="卡面">
          <CardItem
            card={card}
            affixes="names"
            hideSource={hideSource}
            owner={owner}
            onAffixClick={(_card, affix) =>
              setActiveAffix((current) => (current === affix ? null : affix))
            }
          />
        </ul>

        {/* 右栏：完整信息——说明全文 + 词缀逐条全文 */}
        <div className="card-detail-body">
          {card.description === "" ? null : (
            <section className="card-detail-section" aria-label="说明">
              <h3 className="card-detail-heading">说明</h3>
              <p className="card-detail-desc">{card.description}</p>
            </section>
          )}

          {affixes.length === 0 ? null : (
            <section className="card-detail-section" aria-label="词缀">
              <h3 className="card-detail-heading">词缀</h3>
              <ul className="card-detail-affixes">
                {affixes.map(({ key, label, tone, affix }) => {
                  const { name, detail } = readAffixParts(affix);
                  return (
                    <li
                      key={`${key}-${affix}`}
                      className={`card-detail-affix card-detail-affix--${tone}${
                        affix === activeAffix ? " card-detail-affix--active" : ""
                      }`}
                    >
                      <span className={`affix-chip affix-chip--${tone}`}>{label}</span>
                      {name === null ? null : (
                        <span className={`affix-chip affix-chip--${tone}`}>[{name}]</span>
                      )}
                      <span className="card-detail-affix-text">{detail}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
}
