import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { useBlueprint } from "./useBlueprint";

/**
 * 蓝图信息浮窗。
 *
 * 已经进入游戏，所以只保留「宏观世界」的信息——蓝图名字、战役设定、世界系统
 * （`world_entities`）。场景 / 角色、随身背包与仓库等进入游戏后再看没有意义，
 * 不在本浮窗展示（完整蓝图视图见 `BlueprintDetails`，仍用于入口页）。
 */
export default function BlueprintInfoDialog({
  gameName,
  onClose,
}: {
  gameName: string;
  onClose: () => void;
}) {
  const blueprint = useBlueprint(gameName);
  const data = blueprint.data;

  return (
    <Modal title="蓝图信息" onClose={onClose}>
      {blueprint.isPending ? <p className="muted">加载中…</p> : null}
      {blueprint.isError ? (
        <p className="error">无法获取蓝图信息：{String(blueprint.error)}</p>
      ) : null}
      {blueprint.isSuccess && !data ? (
        <p className="error">蓝图列表里没有「{gameName}」。</p>
      ) : null}

      {data ? (
        <>
          <dl className="facts">
            <dt>蓝图名字</dt>
            <dd className="mono">{data.name}</dd>
          </dl>

          <h3>战役设定</h3>
          <p>{data.campaign_setting}</p>

          <h3>世界系统</h3>
          {data.world_entities.length === 0 ? (
            <p className="muted">（无）</p>
          ) : (
            <ul className="plain">
              {data.world_entities.map((entity) => (
                <li key={entity.name} className="mono">
                  {displayName(entity.name)}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Modal>
  );
}
