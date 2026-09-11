import type { Schemas } from "../../api/types";

/**
 * 所选蓝图的宏观视图。
 *
 * 只做展示，字段全部来自生成物推导的 Blueprint 类型，不手写结构。
 * 长文本（战役设定、场景列表、世界实体）用原生 <details> 承载，默认展开但可折叠。
 * 这里刻意不显示 Stage.profile / Actor.profile 等长描述——需要的是"Stage 里有谁"的宏观映射。
 */
export default function BlueprintDetails({ blueprint }: { blueprint: Schemas["Blueprint"] }) {
  return (
    <section className="blueprint">
      <h2>蓝图详情</h2>

      <dl className="facts">
        <dt>玩家角色</dt>
        <dd className="mono">{blueprint.player_actor}</dd>
      </dl>

      <details open>
        <summary>战役设定</summary>
        <p>{blueprint.campaign_setting}</p>
      </details>

      <details open>
        <summary>场景与角色（{blueprint.stages.length}）</summary>
        {blueprint.stages.length === 0 ? (
          <p className="muted">（无）</p>
        ) : (
          <ul className="plain">
            {blueprint.stages.map((stage) => (
              <li key={stage.name}>
                <span className="badge">{stage.type}</span>{" "}
                <span className="mono">{stage.name}</span>
                {" — "}
                <span className="muted">
                  {stage.actors.length === 0
                    ? "无角色"
                    : stage.actors
                        .map(
                          (actor) =>
                            `${actor.name}（${actor.type}${
                              actor.name === blueprint.player_actor ? " · 玩家角色" : ""
                            }）`,
                        )
                        .join("、")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details open>
        <summary>世界实体（{blueprint.world_entities.length}）</summary>
        {blueprint.world_entities.length === 0 ? (
          <p className="muted">（无）</p>
        ) : (
          <ul className="plain">
            {blueprint.world_entities.map((entity) => (
              <li key={entity.name} className="mono">
                {entity.name}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
