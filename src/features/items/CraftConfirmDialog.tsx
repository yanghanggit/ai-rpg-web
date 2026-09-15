import { useState } from "react";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import type { MaterialTotal } from "./types";

/**
 * 合成确认浮窗（叠在道具管理之上的第二层浮窗）。
 *
 * 从储物箱勾选材料、点某个工坊按钮后弹出：列出被勾选的材料，用量默认填满库存上限，
 * 可自行调低。只有点「确认」才真正触发合成；关闭则退回道具管理，不发任何请求。
 */
export default function CraftConfirmDialog({
  label,
  materials,
  busy,
  onConfirm,
  onClose,
}: {
  /** 工坊名，如「合成消耗品」；同时作为浮窗标题。 */
  label: string;
  materials: MaterialTotal[];
  /** 上游已有动作在跑时为 true，禁用确认/取消。 */
  busy: boolean;
  onConfirm: (materials: string[]) => void;
  onClose: () => void;
}) {
  // 每种材料的用量，默认填满库存；随浮窗挂载初始化一次
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(materials.map((material) => [material.name, material.count])),
  );

  function amountOf(name: string, max: number): number {
    const stored = amounts[name];
    const value = typeof stored === "number" && Number.isFinite(stored) ? stored : max;
    return Math.min(Math.max(value, 1), max);
  }

  // 合成接口按「出现次数」消耗材料，所以同名材料要重复出现 amount 次
  const materialNames = materials.flatMap((material) =>
    Array.from({ length: amountOf(material.name, material.count) }, () => material.name),
  );

  return (
    <Modal title={label} meta="确认材料用量" onClose={onClose}>
      {materials.length === 0 ? (
        <p className="muted">没有可用的材料。</p>
      ) : (
        <ul className="plain">
          {materials.map((material) => (
            <li key={material.name} className="item-row">
              <span className="mono item-name">
                {displayName(material.name)}（库存 ×{material.count}）
              </span>
              <label className="item-amount">
                用量
                <input
                  type="number"
                  min={1}
                  max={material.count}
                  value={amountOf(material.name, material.count)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setAmounts((previous) => ({
                      ...previous,
                      [material.name]: Number.isFinite(next) ? next : material.count,
                    }));
                  }}
                  aria-label={`${material.name} 用量`}
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="modal-actions">
        <button
          type="button"
          disabled={busy || materialNames.length === 0}
          onClick={() => onConfirm(materialNames)}
        >
          确认
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  );
}
