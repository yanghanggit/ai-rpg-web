import { useState } from "react";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CraftConfirmDialog from "./CraftConfirmDialog";
import { collectMaterials } from "./collectMaterials";
import type { Item, ItemType, MaterialTotal } from "./types";
import { useCraftItem, type Workshop } from "./useCraftItem";
import { useItemContainers } from "./useItemContainers";
import { useMoveItem } from "./useMoveItem";

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  GearItem: "装备",
  CostumeItem: "时装",
  ConsumableItem: "消耗品",
  MaterialItem: "材料",
};

const WORKSHOPS: { workshop: Workshop; label: string }[] = [
  { workshop: "consumable", label: "合成消耗品" },
  { workshop: "gear", label: "制造装备" },
  { workshop: "costume", label: "制作时装" },
];

/** 显示名 + 数量后缀（`×N` 只在多于一件时出现）。 */
function itemText(item: Item): string {
  return item.count > 1 ? `${displayName(item.name)} ×${item.count}` : displayName(item.name);
}

/** 道具行：可移动的行带勾选框，不可移动的（储物箱里的时装）只标注。 */
function ItemRow({
  item,
  selected,
  onToggle,
}: {
  item: Item;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <li className="item-row">
      {onToggle ? (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={onToggle}
          aria-label={`选择 ${item.name}`}
        />
      ) : (
        <span className="chip">不可移动</span>
      )}
      <span className="mono item-name">{itemText(item)}</span>
      <span className="chip">{ITEM_TYPE_LABELS[item.type]}</span>
      <span className="muted item-desc">{item.description}</span>
    </li>
  );
}

/**
 * 道具管理浮窗。
 *
 * 两段内容：
 * - 随身背包：勾选后批量移入储物箱；
 * - 储物箱：顶部是**穿戴中的时装**（`WornCostumeComponent`，脱下来就回归储物箱，
 *   所以视为储物箱里挂出去的一件，只读展示并标注穿戴者），下面是箱内道具。
 *   勾选后可与「移入背包」平级的三个工坊按钮——点开会叠出第二层确认浮窗，
 *   默认填入已勾选材料与最大用量，确认才真正合成。
 */
export default function ItemManagerDialog({
  userName,
  gameName,
  actorName,
  busy = false,
  onClose,
}: {
  userName: string;
  gameName: string;
  actorName: string;
  /** 家园页已有 pipeline 动作在跑时为 true，此时禁用所有操作。 */
  busy?: boolean;
  onClose: () => void;
}) {
  const containers = useItemContainers(userName, gameName, actorName);
  const move = useMoveItem(userName, gameName);
  const craft = useCraftItem(userName, gameName);

  const [inventorySelection, setInventorySelection] = useState<string[]>([]);
  const [storageSelection, setStorageSelection] = useState<string[]>([]);
  // 待确认的合成请求；非空时叠出第二层浮窗
  const [craftRequest, setCraftRequest] = useState<{
    workshop: Workshop;
    label: string;
    materials: MaterialTotal[];
  } | null>(null);

  const isMutating = busy || move.isPending || craft.isStarting || craft.isRunning;

  // 勾选的道具里能送工坊的只有材料；同名材料按名字汇总
  const checkedMaterials = collectMaterials(
    containers.storage.filter((item) => storageSelection.includes(item.name)),
  );

  function toggle(list: string[], name: string): string[] {
    return list.includes(name) ? list.filter((entry) => entry !== name) : [...list, name];
  }

  function runMove(direction: "inventory" | "storage") {
    const names = direction === "inventory" ? inventorySelection : storageSelection;
    if (names.length === 0 || isMutating) {
      return;
    }
    if (direction === "inventory") {
      setInventorySelection([]);
      move.moveToStorage(names);
    } else {
      setStorageSelection([]);
      move.moveToInventory(names);
    }
  }

  return (
    <Modal
      title="道具管理"
      meta={`背包 ${containers.inventory.length} · 储物箱 ${containers.storage.length}`}
      // 第二层浮窗开着时，本层的 ESC 不响应（否则会连带关掉整页浮窗）
      onClose={() => {
        if (!craftRequest) {
          onClose();
        }
      }}
    >
      {containers.isPending ? <p className="muted">加载中…</p> : null}
      {containers.isError ? (
        <p className="error">无法获取道具：{String(containers.error)}</p>
      ) : null}
      {move.error ? <p className="error">移动失败：{move.error}</p> : null}
      {craft.error ? <p className="error">合成失败：{craft.error}</p> : null}

      {containers.isSuccess ? (
        <>
          <h3>随身背包</h3>
          {containers.inventory.length === 0 ? (
            <p className="muted">（空）</p>
          ) : (
            <ul className="plain">
              {containers.inventory.map((item) => (
                <ItemRow
                  key={item.uuid || item.name}
                  item={item}
                  selected={inventorySelection.includes(item.name)}
                  onToggle={() => setInventorySelection((previous) => toggle(previous, item.name))}
                />
              ))}
            </ul>
          )}
          <div className="modal-actions">
            <button
              type="button"
              disabled={inventorySelection.length === 0 || isMutating}
              onClick={() => runMove("inventory")}
            >
              移入储物箱（{inventorySelection.length}）
            </button>
          </div>

          <h3>储物箱</h3>
          <ul className="plain">
            {/* 穿戴中的时装：脱下来就回归储物箱，所以置顶只读展示 */}
            {containers.worn.map((worn) => (
              <li key={worn.wearer} className="item-row">
                <span className="chip">穿戴中（只读）</span>
                <span className="mono item-name">
                  {`${displayName(worn.wearer)} · ${itemText(worn.item)}`}
                </span>
                <span className="chip">{ITEM_TYPE_LABELS[worn.item.type]}</span>
                <span className="muted item-desc">{worn.item.description}</span>
              </li>
            ))}
            {containers.storage.map((item) => {
              // 时装不允许移入背包（后端硬性拒绝），所以勾选框只给非时装
              const movable = item.type !== "CostumeItem";
              return (
                <ItemRow
                  key={item.uuid || item.name}
                  item={item}
                  selected={movable && storageSelection.includes(item.name)}
                  onToggle={
                    movable
                      ? () => setStorageSelection((previous) => toggle(previous, item.name))
                      : undefined
                  }
                />
              );
            })}
          </ul>
          {containers.worn.length === 0 && containers.storage.length === 0 ? (
            <p className="muted">（空）</p>
          ) : null}

          <div className="modal-actions">
            <button
              type="button"
              disabled={storageSelection.length === 0 || isMutating}
              onClick={() => runMove("storage")}
            >
              移入背包（{storageSelection.length}）
            </button>
            {WORKSHOPS.map(({ workshop, label }) => (
              <button
                key={workshop}
                type="button"
                disabled={checkedMaterials.length === 0 || isMutating}
                onClick={() => setCraftRequest({ workshop, label, materials: checkedMaterials })}
              >
                {label}
              </button>
            ))}
          </div>
          {craft.isStarting ? <p className="muted">提交合成…</p> : null}
          {craft.isRunning ? <p className="muted">合成中…（结果会出现在叙事里）</p> : null}
        </>
      ) : null}

      {craftRequest ? (
        <CraftConfirmDialog
          label={craftRequest.label}
          materials={craftRequest.materials}
          busy={busy || craft.isStarting || craft.isRunning}
          onConfirm={(materials) => {
            const { workshop } = craftRequest;
            setStorageSelection([]);
            setCraftRequest(null);
            craft.start(workshop, materials);
          }}
          onClose={() => setCraftRequest(null)}
        />
      ) : null}
    </Modal>
  );
}
