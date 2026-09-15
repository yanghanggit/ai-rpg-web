import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { useStorageCostumes } from "./useStorageCostumes";

/**
 * 选择时装浮窗（叠在角色信息之上的第二层浮窗）。
 *
 * 列出储物箱里的时装，点一件即穿到目标角色身上（一件一步）；关闭则返回角色信息。
 */
export default function StorageCostumeDialog({
  userName,
  gameName,
  targetName,
  busy,
  onWear,
  onClose,
}: {
  userName: string;
  gameName: string;
  /** 穿装对象（角色原始名）。 */
  targetName: string;
  /** 换装任务在跑时为 true，禁用选项。 */
  busy: boolean;
  onWear: (itemName: string) => void;
  onClose: () => void;
}) {
  const storage = useStorageCostumes(userName, gameName, true);

  return (
    <Modal title="选择时装" meta={displayName(targetName)} onClose={onClose}>
      {storage.isPending ? <p className="muted">加载中…</p> : null}
      {storage.isError ? <p className="error">无法读取储物箱：{String(storage.error)}</p> : null}
      {storage.isSuccess && storage.costumes.length === 0 ? (
        <p className="muted">储物箱里没有时装。</p>
      ) : null}

      {storage.costumes.length > 0 ? (
        <ul className="plain">
          {storage.costumes.map((costume) => (
            <li key={costume.uuid || costume.name}>
              <button
                type="button"
                className="costume-option"
                disabled={busy}
                onClick={() => onWear(costume.name)}
              >
                <span className="mono">{displayName(costume.name)}</span>
                {costume.description ? <span className="muted"> {costume.description}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}
