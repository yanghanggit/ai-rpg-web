import { useState } from "react";
import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CardListDialog from "../cards/CardListDialog";
import type { Card } from "../cards/types";
import { useDungeonDecks } from "./useDungeonDecks";

/**
 * 玩家控制的角色排第一位；其余保持后端给的顺序（`sort` 稳定）。
 */
function orderPlayerFirst<T extends { player: boolean }>(members: T[]): T[] {
  return [...members].sort((a, b) => Number(b.player) - Number(a.player));
}

/** 二级选中的角色（名字 + 牌组快照）；`null` 表示只看一级名单。 */
interface PickedDeck {
  name: string;
  deck: Card[];
}

/**
 * 「牌组一览」浮窗：一级列本间双方（我方玩家在前 + 本间怪物），点某行叠出二级 `CardListDialog`。
 *
 * 数据来自 `useDungeonDecks`（只在本浮窗挂载时才发请求）。两层都在本组件内管理：二级开着时
 * 一级的 `onClose` 不响应，避免一次 ESC 连关两层。
 */
export default function DeckBrowserDialog({
  userName,
  gameName,
  room,
  onClose,
}: {
  userName: string;
  gameName: string;
  /** 当前房间（用来取本间怪物）；不在房间里时为 `null`，只列我方。 */
  room: Schemas["OpeningRoom"] | Schemas["CombatRoom"] | null;
  onClose: () => void;
}) {
  const decks = useDungeonDecks(userName, gameName, room);
  /** 二级选中的成员；`null` 表示只看一级名单。 */
  const [picked, setPicked] = useState<PickedDeck | null>(null);

  const party = orderPlayerFirst(decks.party);

  // 二级开着时一级不响应关闭（ESC 由最上层处理）
  const closeList = () => {
    if (picked === null) {
      onClose();
    }
  };

  return (
    <>
      <Modal title="牌组一览" size="sm" onClose={closeList}>
        {decks.isPending ? <p className="muted">加载中…</p> : null}
        {decks.isError ? <p className="error">无法获取牌组：{String(decks.error)}</p> : null}

        {!decks.isPending && !decks.isError ? (
          <>
            <section className="camp-section">
              <h3>我方</h3>
              {party.length === 0 ? (
                <p className="muted">（队伍里没有角色）</p>
              ) : (
                <ul className="action-list deck-list">
                  {party.map((member) => (
                    <li key={member.name}>
                      {/* 整行一颗按钮：名字 + 玩家徽标在左、张数在右，行尾箭头暗示可点进二级 */}
                      <button
                        type="button"
                        className="deck-row"
                        onClick={() => setPicked({ name: member.name, deck: member.deck })}
                      >
                        <span>{displayName(member.name)}</span>
                        {member.player ? <span className="badge">玩家</span> : null}
                        <span className="action-meta">{member.deck.length} 张</span>
                        <span className="deck-row-chevron" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 开场房 / 没有怪物的房间不出现「敌方」这一段 */}
            {decks.monsters.length === 0 ? null : (
              <section className="camp-section">
                <h3>敌方</h3>
                <ul className="action-list deck-list">
                  {decks.monsters.map((monster) => (
                    <li key={monster.name}>
                      <button
                        type="button"
                        className="deck-row"
                        onClick={() => setPicked({ name: monster.name, deck: monster.deck })}
                      >
                        <span>{displayName(monster.name)}</span>
                        <span className="badge">怪物</span>
                        <span className="action-meta">{monster.deck.length} 张</span>
                        <span className="deck-row-chevron" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </Modal>

      {picked !== null ? (
        <CardListDialog
          title="牌组"
          actorName={picked.name}
          cards={picked.deck}
          emptyText="（牌组为空）"
          hideSource
          onClose={() => setPicked(null)}
        />
      ) : null}
    </>
  );
}
