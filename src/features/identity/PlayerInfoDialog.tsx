import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { readPlayerInfo } from "./readPlayerInfo";
import { usePlayerEntity } from "./usePlayerEntity";

/**
 * 玩家控制角色的信息浮窗。
 *
 * 对应常规游戏里「点击玩家头像弹出的自身信息页」：集中展示玩家实体上必要的组件信息
 * （PlayerComponent / IdentityComponent / AppearanceComponent / CharacterStatsComponent）。
 * `data` 的逐字段校验见 `readPlayerInfo`——字段缺失就显示占位，不猜。
 */
export default function PlayerInfoDialog({
  userName,
  gameName,
  actorName,
  onClose,
}: {
  userName: string;
  gameName: string;
  actorName: string;
  onClose: () => void;
}) {
  const entity = usePlayerEntity(userName, gameName, actorName);
  const player = entity.data?.entities[0];
  const info = player ? readPlayerInfo(player) : null;

  return (
    <Modal title="角色信息" meta={displayName(actorName)} onClose={onClose}>
      {entity.isPending ? <p className="muted">加载中…</p> : null}
      {entity.isError ? <p className="error">无法获取角色信息：{String(entity.error)}</p> : null}
      {entity.isSuccess && !player ? <p className="error">服务器没有返回该角色实体。</p> : null}

      {player && info ? (
        <>
          <dl className="facts">
            <dt>玩家名</dt>
            <dd className="mono">{info.player_name ?? "—"}</dd>
            <dt>实体名</dt>
            <dd className="mono">{displayName(player.name)}</dd>
            <dt>实体 ID</dt>
            <dd className="mono">{info.entity_id ?? "—"}</dd>
            <dt>创建序号</dt>
            <dd className="mono">{info.creation_order ?? "—"}</dd>
          </dl>

          <h3>属性</h3>
          {info.stats ? (
            <dl className="facts">
              <dt>生命</dt>
              <dd className="mono">{`${info.stats.hp} / ${info.stats.max_hp}`}</dd>
              <dt>攻击</dt>
              <dd className="mono">{info.stats.attack}</dd>
              <dt>防御</dt>
              <dd className="mono">{info.stats.defense}</dd>
            </dl>
          ) : (
            <p className="muted">（无属性数据）</p>
          )}

          <h3>外观</h3>
          {info.appearance || info.base_body ? (
            <dl className="facts">
              <dt>当前</dt>
              <dd>{info.appearance ?? "—"}</dd>
              <dt>基础</dt>
              <dd>{info.base_body ?? "—"}</dd>
            </dl>
          ) : (
            <p className="muted">（无外观数据）</p>
          )}
        </>
      ) : null}
    </Modal>
  );
}
