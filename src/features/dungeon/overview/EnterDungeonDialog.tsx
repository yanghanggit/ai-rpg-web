import { displayName } from "../../../components/displayName";
import Modal from "../../../components/Modal";
import ItemRow from "../../items/ItemRow";
import { readDungeonInfo } from "../readDungeonInfo";
import { useDungeonList } from "./useDungeonList";
import { useEnterPreview } from "./useEnterPreview";

/**
 * 进入副本前的最终确认浮窗（一级）：把「最终带谁」「背包有什么」摊开——出征不可逆，
 * 队伍在退出副本前不能再改。队伍里有死亡成员会让后端断言失败，所以提前禁用确认并说明原因。
 * 取数交给 `useEnterPreview`（一次 details）。
 */
export default function EnterDungeonDialog({
  userName,
  gameName,
  playerActor,
  dungeonName,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  userName: string;
  gameName: string;
  /** 玩家角色原始名（确认框里标出「你」）。 */
  playerActor: string;
  /** 要进入的副本原始名（`副本.荒废地窟`）。 */
  dungeonName: string;
  /** 提交中：禁用两个按钮，避免重复发起。 */
  busy: boolean;
  /** 提交失败的原因（后端 `detail` 优先）。 */
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const preview = useEnterPreview(userName, gameName, playerActor);

  // 起点房间与「地图」浮窗同源：从列表缓存里取
  const dungeons = useDungeonList();
  const dungeon = dungeons.data?.find((item) => item.name === dungeonName);
  const entryRoom = dungeon ? readDungeonInfo(dungeon).rooms[0] : undefined;

  const deadMembers = preview.party.filter((member) => member.dead);
  const blockedMembers = deadMembers;

  return (
    <Modal title="进入副本" meta={displayName(dungeonName)} onClose={onClose}>
      {entryRoom ? (
        <p>
          起点：<span className="mono">{displayName(entryRoom.stageName)}</span>{" "}
          <span className={entryRoom.type === "combat" ? "badge badge--combat" : "badge"}>
            {entryRoom.typeLabel}
          </span>
        </p>
      ) : null}

      <h3>队伍（{preview.party.length} 人）</h3>
      {preview.isPending ? <p className="muted">加载中…</p> : null}
      {preview.isError ? <p className="error">无法获取出战信息：{String(preview.error)}</p> : null}
      {preview.party.length > 0 ? (
        <ul className="plain party-preview">
          {preview.party.map((member) => (
            <li key={member.name} className="item-row">
              <span className="item-name">
                <span className="mono">{displayName(member.name)}</span>
                {member.player ? <span className="muted">（玩家）</span> : null}
              </span>
              {member.dead ? (
                <span className="error">已死亡，无法参战</span>
              ) : member.stats ? (
                <span className="muted">
                  hp {member.stats.hp}/{member.stats.max_hp} · attack {member.stats.attack} ·
                  defense {member.stats.defense}
                </span>
              ) : (
                <span className="muted">属性未知</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <h3>背包（{preview.inventory.length} 件）</h3>
      {preview.inventory.length === 0 ? (
        <p className="muted">背包是空的。进去前可以先回总览整理行装。</p>
      ) : (
        <ul className="plain">
          {/* 与道具管理里长得一样 */}
          {preview.inventory.map((item) => (
            <ItemRow key={item.uuid || item.name} item={item} />
          ))}
        </ul>
      )}

      {deadMembers.length > 0 ? (
        <p className="error">队伍里有已死亡的角色，请先在队伍名单里移出他们。</p>
      ) : null}
      {error ? <p className="error">进入副本失败：{error}</p> : null}

      <div className="modal-actions">
        <button type="button" disabled={busy || blockedMembers.length > 0} onClick={onConfirm}>
          {busy ? "进入中…" : "确认进入"}
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  );
}
