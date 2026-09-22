import { useState } from "react";
import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CardListDialog from "../cards/CardListDialog";
import type { Card } from "../cards/types";
import { useDungeonDecks } from "./useDungeonDecks";

/**
 * 玩家控制的角色排在第一位，其余保持后端给的顺序（`sort` 稳定，所以不会被重排）。
 *
 * 队伍顺序本应由后端固定（进副本时的名单顺序），但「第一个是玩家」是**界面要求**，
 * 不指望上游顺带保证，所以在这里显式排一次。
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
 * 「牌组一览」浮窗：**一级**列出**本间**双方——我方队伍（玩家排在第一位）与本间场景里的怪物，
 * 点某一行叠出**二级** `CardListDialog`（标题「牌组」）看该角色的牌组（再点卡则是它自己管的三级卡牌详情）。
 *
 * 数据来自 `useDungeonDecks`（队伍复用 `useDungeonParty`；怪物以当前房间 `room.stage.actors`
 * 覆盖——`setup_dungeon` 会一次建出副本所有房间的怪物，所以必须按房间过滤，见该 hook 注释）。
 * hook 只在本浮窗挂载时才发请求，所以房间页不会为了一个入口先把牌组拉下来。
 *
 * **两层都在本组件内管理**：二级开着时一级的 `onClose` 不响应，避免一次 ESC 连关两层
 * （与 `HomeOverviewPage` 的 `ActorInfoDialog` / `StorageCostumeDialog` 同一手法，
 * 见 docs/pages.md「浮窗层级」）。这两层同属 `features/dungeon`，所以不需要页面接线。
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

  // 二级开着时一级不响应关闭（ESC 由最上层那层处理），否则一次 ESC 会把两层一起关掉
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
            <section className="deck-section">
              <h3>我方</h3>
              {party.length === 0 ? (
                <p className="muted">（队伍里没有角色）</p>
              ) : (
                <ul className="action-list deck-list">
                  {party.map((member) => (
                    <li key={member.name}>
                      {/* 整行是一颗按钮：名字 + 玩家徽标在左、张数在右，行尾一个小箭头把
                          "点进二级"做在视觉上（不另写一句提示文字） */}
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

            {/* 开场房 / 没有怪物的房间不出现「敌方」这一段，行为与只有我方时一致 */}
            {decks.monsters.length === 0 ? null : (
              <section className="deck-section">
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
