import Modal from "../../../components/Modal";
import ItemRow from "../../items/ItemRow";
import type { Item } from "../../items/types";

/**
 * 战斗战利品浮窗（`LootComponent.items`）。
 *
 * 与开场房的 `SpoilsDialog` 同族：**结算页那颗按钮只负责打开它**，真正的收取在这里确认。
 * 先把"这一场掉了什么"摊开给人看，再决定收不收——战利品是打完那一瞬间最想确认的东西，
 * 只给一个数字（收取按钮上的数量）看不见内容。
 *
 * 道具行一律走 `ItemRow`（"一件道具长什么样"的唯一实现）：显示名 + 数量 + 中文类型 + 描述。
 * `Item` 的四种类型（装备 / 时装 / 消耗品 / 材料）都认——`LootComponent.items` 契约上是
 * `AnyItem`（服务端 `models/items.py` 的四种联合），解析已在 `readItems` / `readItem` 里做过，
 * 未知类型在那一步就被挡掉，所以这里不必再分叉。
 *
 * 收取结果由调用方持有（`CombatPostPanel` 的 `useCollectLoot`）：本层只把 `busy` / `error`
 * 画出来，成功后由调用方关掉浮窗（战利品清空，没什么可看了）。
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
