import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { firstEntity } from "../entities/ecs";
import { readActorInfo } from "./readActorInfo";
import { useActorEntity } from "./useActorEntity";

/**
 * 角色信息浮窗（玩家与 NPC 共用，靠 `actorName` 区分）。
 *
 * 展示 Identity / Appearance / CharacterStats（玩家另有 Player，穿着时装则有 WornCostume），
 * 并给出穿 / 脱时装入口；字段校验在 `readActorInfo`（缺失即占位，不猜）。
 * `costumeEnabled`：副本进行中家园接口会被拒绝，所以副本里关掉这个入口。
 */
export default function ActorInfoDialog({
  userName,
  gameName,
  actorName,
  busy = false,
  costumeEnabled = true,
  costumeBusy = false,
  costumeError = null,
  onWearCostume,
  onRemoveCostume,
  onClose,
}: {
  userName: string;
  gameName: string;
  actorName: string;
  /** 家园页已有 pipeline 动作在跑时为 true。 */
  busy?: boolean;
  /** 是否提供穿/脱时装入口；副本进行中传 false（家园接口会被拒）。 */
  costumeEnabled?: boolean;
  /** 穿/脱时装任务在跑时为 true。 */
  costumeBusy?: boolean;
  costumeError?: string | null;
  onWearCostume?: () => void;
  onRemoveCostume?: () => void;
  onClose: () => void;
}) {
  const entity = useActorEntity(userName, gameName, actorName);
  const actor = firstEntity(entity.data?.entities ?? {});
  const info = actor ? readActorInfo(actor) : null;
  const actionsDisabled = busy || costumeBusy;

  return (
    <Modal title="角色信息" meta={displayName(actorName)} onClose={onClose}>
      {entity.isPending ? <p className="muted">加载中…</p> : null}
      {entity.isError ? <p className="error">无法获取角色信息：{String(entity.error)}</p> : null}
      {entity.isSuccess && !actor ? <p className="error">服务器没有返回该角色实体。</p> : null}

      {actor && info ? (
        <>
          <dl className="facts">
            {/* 玩家名只有玩家实体才有（PlayerComponent），NPC 不显示这一行 */}
            {info.player_name ? (
              <>
                <dt>玩家名</dt>
                <dd className="mono">{info.player_name}</dd>
              </>
            ) : null}
            <dt>实体名</dt>
            <dd className="mono">{displayName(actor.name)}</dd>
            <dt>实体 ID</dt>
            <dd className="mono">{info.entity_id ?? "—"}</dd>
            <dt>创建序号</dt>
            <dd className="mono">{info.creation_order ?? "—"}</dd>
          </dl>

          <h3>属性</h3>
          {info.stats ? (
            <dl className="facts">
              <dt className="mono">hp</dt>
              <dd className="mono">{info.stats.hp}</dd>
              <dt className="mono">max_hp</dt>
              <dd className="mono">{info.stats.max_hp}</dd>
              <dt className="mono">attack</dt>
              <dd className="mono">{info.stats.attack}</dd>
              <dt className="mono">defense</dt>
              <dd className="mono">{info.stats.defense}</dd>
              <dt className="mono">speed</dt>
              <dd className="mono">{info.stats.speed}</dd>
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

          {costumeEnabled ? (
            <>
              <h3>时装</h3>
              {info.worn_costume ? (
                <dl className="facts">
                  <dt>穿着中</dt>
                  <dd>
                    {displayName(info.worn_costume.name)}
                    {info.worn_costume.description ? ` —— ${info.worn_costume.description}` : ""}
                  </dd>
                </dl>
              ) : (
                <p className="muted">（未穿戴时装）</p>
              )}

              <div className="modal-actions">
                {info.worn_costume ? (
                  <>
                    <button type="button" disabled={actionsDisabled} onClick={onWearCostume}>
                      换一件时装
                    </button>
                    <button type="button" disabled={actionsDisabled} onClick={onRemoveCostume}>
                      脱下时装
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={actionsDisabled} onClick={onWearCostume}>
                    穿时装
                  </button>
                )}
              </div>
              {costumeError ? <p className="error">时装操作失败：{costumeError}</p> : null}
            </>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
