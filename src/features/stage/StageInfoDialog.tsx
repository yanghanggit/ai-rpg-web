import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { firstEntity } from "../entities/ecs";
import { readStageInfo } from "./readStageInfo";
import { useStageEntity } from "./useStageEntity";

/**
 * 场景信息浮窗。
 *
 * 从卡片右上角的小按钮打开，展示该场景实体的 `StageComponent` / `EnvironmentComponent`，
 * 并把场景内的角色列成按钮——点一个即进入该角色的信息浮窗，形成「卡片 → 场景 → 角色」的闭环。
 * 浮窗比卡片大，所以环境叙述这类长文本可以完整展开（不需要额外请求：角色名单由调用方传入）。
 */
export default function StageInfoDialog({
  userName,
  gameName,
  stageName,
  actorNames,
  incapacitated = new Set(),
  onSelectActor,
  onClose,
}: {
  userName: string;
  gameName: string;
  /** 场景原始名（`场景.酒吧大厅`）。 */
  stageName: string;
  /** 该场景内的角色原始名列表（来自 stages state 的 actors_by_stage）。 */
  actorNames: string[];
  /** 已永久失能的角色原始名集合；命中的 chip 加标记。 */
  incapacitated?: ReadonlySet<string>;
  onSelectActor: (actorName: string) => void;
  onClose: () => void;
}) {
  const entity = useStageEntity(userName, gameName, stageName);
  const stage = firstEntity(entity.data?.entities ?? {});
  const info = stage ? readStageInfo(stage) : null;

  return (
    <Modal title="场景信息" meta={displayName(stageName)} onClose={onClose}>
      {entity.isPending ? <p className="muted">加载中…</p> : null}
      {entity.isError ? <p className="error">无法获取场景信息：{String(entity.error)}</p> : null}
      {entity.isSuccess && !stage ? <p className="error">服务器没有返回该场景实体。</p> : null}

      {stage && info ? (
        <>
          <dl className="facts">
            <dt>场景名</dt>
            <dd className="mono">{displayName(info.name)}</dd>
          </dl>

          <h3>环境叙述</h3>
          {info.narrative ? <p>{info.narrative}</p> : <p className="muted">（暂无环境描述）</p>}

          <h3>场景内角色</h3>
          {actorNames.length === 0 ? (
            <p className="muted">（无角色）</p>
          ) : (
            <ul className="chips">
              {actorNames.map((actorName) => {
                const isIncapacitated = incapacitated.has(actorName);
                return (
                  <li key={actorName}>
                    <button
                      type="button"
                      className={
                        isIncapacitated
                          ? "chip chip-button mono chip--incapacitated"
                          : "chip chip-button mono"
                      }
                      title={isIncapacitated ? "已永久失能" : undefined}
                      onClick={() => onSelectActor(actorName)}
                    >
                      {displayName(actorName)}
                      {isIncapacitated ? (
                        <span className="badge badge--incapacitated">失能</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </Modal>
  );
}
