import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";

/**
 * 实体浏览器浮窗：把「场景 → 角色」的 actors_by_stage 一次性摊开，作为快捷/宏观入口。
 *
 * 与点场景卡片是**同样的结果**，只是多一条路径：这里能一眼看到全部 Stage / Actor。
 * 点场景名 → 场景信息浮窗；点角色名 → 角色信息浮窗。
 *
 * 只做展示与回调，具体打开哪个浮窗由页面负责（`features/` 之间不互相依赖）。
 * actorsByStage 直接来自 stages state，顺序沿用后端返回顺序，不排序、不重排。
 */
export default function EntityBrowserDialog({
  actorsByStage,
  onSelectStage,
  onSelectActor,
  onClose,
}: {
  /** 场景原始名 → 该场景内角色原始名列表。 */
  actorsByStage: Record<string, string[]>;
  onSelectStage: (stageName: string) => void;
  onSelectActor: (actorName: string) => void;
  onClose: () => void;
}) {
  const stages = Object.entries(actorsByStage);

  return (
    <Modal title="实体浏览器" onClose={onClose}>
      <p className="muted">共 {stages.length} 个场景。点场景名看场景信息，点角色名看角色信息。</p>

      {stages.length === 0 ? (
        <p className="muted">（暂无实体）</p>
      ) : (
        <ul className="entity-browser">
          {stages.map(([stage, actorNames]) => (
            <li key={stage}>
              <button
                type="button"
                className="entity-stage mono"
                onClick={() => onSelectStage(stage)}
              >
                {displayName(stage)}
              </button>
              {actorNames.length === 0 ? (
                <p className="muted entity-empty">（无角色）</p>
              ) : (
                <ul className="chips">
                  {actorNames.map((actorName) => (
                    <li key={actorName}>
                      <button
                        type="button"
                        className="chip chip-button mono"
                        onClick={() => onSelectActor(actorName)}
                      >
                        {displayName(actorName)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
