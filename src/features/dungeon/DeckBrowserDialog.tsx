import { useState } from "react";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import DeckDialog from "./DeckDialog";
import { type OpeningPartyMember, useOpeningParty } from "./opening/useOpeningParty";

/**
 * 玩家控制的角色排在第一位，其余保持后端给的顺序（`sort` 稳定，所以不会被重排）。
 *
 * 队伍顺序本应由后端固定（进副本时的名单顺序），但「第一个是玩家」是**界面要求**，
 * 不指望上游顺带保证，所以在这里显式排一次。
 */
function orderPlayerFirst(members: OpeningPartyMember[]): OpeningPartyMember[] {
  return [...members].sort((a, b) => Number(b.player) - Number(a.player));
}

/**
 * 「牌组」浏览浮窗：**一级**是本次副本的队伍名单（玩家排在第一位），点某一行叠出**二级**
 * `DeckDialog` 看该角色的牌组（再点卡则是 `DeckDialog` 自己管的三级卡牌详情）。
 *
 * 数据复用 `useOpeningParty`（进副本时固化的队伍快照 + 各成员的 `DeckComponent`），不新增接口；
 * hook 只在本浮窗挂载时才发请求，所以房间页不会为了一个入口先把队伍拉下来。
 *
 * **两层都在本组件内管理**：二级开着时一级的 `onClose` 不响应，避免一次 ESC 连关两层
 * （与 `HomeOverviewPage` 的 `ActorInfoDialog` / `StorageCostumeDialog` 同一手法，
 * 见 docs/pages.md「浮窗层级」）。这两层同属 `features/dungeon`，所以不需要页面接线。
 */
export default function DeckBrowserDialog({
  userName,
  gameName,
  onClose,
}: {
  userName: string;
  gameName: string;
  onClose: () => void;
}) {
  const party = useOpeningParty(userName, gameName);
  /** 二级选中的角色名；`null` 表示只看一级名单。 */
  const [selected, setSelected] = useState<string | null>(null);

  const members = orderPlayerFirst(party.party);
  const picked = party.party.find((member) => member.name === selected) ?? null;

  // 二级开着时一级不响应关闭（ESC 由最上层那层处理），否则一次 ESC 会把两层一起关掉
  const closeList = () => {
    if (selected === null) {
      onClose();
    }
  };

  return (
    <>
      <Modal title="队伍牌组" size="sm" onClose={closeList}>
        <p className="muted">点名字查看该角色的牌组。</p>

        {party.isPending ? <p className="muted">加载中…</p> : null}
        {party.isError ? <p className="error">无法获取队伍牌组：{String(party.error)}</p> : null}

        {!party.isPending && !party.isError ? (
          members.length === 0 ? (
            <p className="muted">（队伍里没有角色）</p>
          ) : (
            <ul className="action-list">
              {members.map((member) => (
                <li key={member.name}>
                  {/* 整行是一颗按钮，点击区域大；名字 + 玩家徽标在左、张数在右 */}
                  <button
                    type="button"
                    className="deck-row"
                    onClick={() => setSelected(member.name)}
                  >
                    <span>{displayName(member.name)}</span>
                    {member.player ? <span className="badge">玩家</span> : null}
                    <span className="action-meta">{member.deck.length} 张</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Modal>

      {picked !== null ? (
        <DeckDialog
          memberName={picked.name}
          cards={picked.deck}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
