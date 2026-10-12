import Modal from "../../../components/Modal";
import ItemRow from "../../items/ItemRow";
import type { Item } from "../../items/types";

/**
 * 战斗战利品浮窗（`LootComponent.items`）：与开场房 `SpoilsDialog` 同族，真正的收取在这里确认。
 * 道具行走 `ItemRow`（道具展示的唯一实现）；收取结果（`busy` / `error`）由调用方持有。
 */
export default function LootDialog({
  loot,
  busy,
  error,
  onCollect,
  onClose,
}: {
  /** 玩家身上 `LootComponent` 的现役战利品（已解析成 `Item`）。 */
  loot: Item[];
  /** 收取同步接口在跑时为 true：禁用「收取全部」。 */
  busy: boolean;
  /** 收取失败的原因（展示在浮窗内）。 */
  error: string | null;
  onCollect: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="战利品" meta={`共 ${loot.length} 件`} onClose={onClose}>
      {error ? <p className="error">收取战利品失败：{error}</p> : null}

      <ul className="items">
        {loot.map((item) => (
          <ItemRow key={item.uuid === "" ? item.name : item.uuid} item={item} />
        ))}
      </ul>

      <div className="toolbar">
        <button type="button" disabled={busy} onClick={onCollect}>
          {busy ? "收取中…" : `收取全部（${loot.length}）`}
        </button>
      </div>
    </Modal>
  );
}
