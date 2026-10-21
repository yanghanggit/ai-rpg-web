import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import { collectItemContainers } from "./collectItemContainers";

/**
 * 物品类型（后端 `ItemType`）→ 界面上的说法。未知类型直接显示原值：不猜，也不隐藏。
 * 这只是一张展示用标签表，与契约无关。
 */
const ITEM_TYPE_LABELS: Record<string, string> = {
  GearItem: "装备",
  CostumeItem: "时装",
  ConsumableItem: "消耗品",
  MaterialItem: "材料",
};

/**
 * 所选蓝图的宏观视图（只读，字段全部来自蓝图的生成物类型）。
 *
 * 长文本用 `<details>`：战役设定 / 场景 / 角色默认展开，世界实体默认折叠。
 * 实体名走 `displayName`，但 key 与"是否玩家"仍用原始名——显示名不能当身份。
 */
export default function BlueprintDetails({ blueprint }: { blueprint: Schemas["Blueprint"] }) {
  const containers = collectItemContainers(blueprint);

  return (
    <section className="blueprint">
      <h2>
        蓝图详情：<span className="mono">{blueprint.name}</span>
      </h2>

      <dl className="facts">
        <dt>玩家角色</dt>
        <dd className="mono">{displayName(blueprint.player_actor)}</dd>
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
                <span className="mono">{displayName(stage.name)}</span>
                {" — "}
                <span className="muted">
                  {stage.actors.length === 0
                    ? "无角色"
                    : stage.actors
                        .map(
                          (actor) =>
                            `${displayName(actor.name)}（${actor.type}${
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

      <details>
        <summary>世界实体（{blueprint.world_entities.length}）</summary>
        {blueprint.world_entities.length === 0 ? (
          <p className="muted">（无）</p>
        ) : (
          <ul className="plain">
            {blueprint.world_entities.map((entity) => (
              <li key={entity.name} className="mono">
                {displayName(entity.name)}
              </li>
            ))}
          </ul>
        )}
      </details>

      {containers.map((container) => (
        <details key={container.label}>
          <summary>
            {container.label}（{container.items.length}）
          </summary>
          <ul className="plain items">
            {container.items.map((item) => (
              <li key={item.name}>
                <span className="badge">{ITEM_TYPE_LABELS[item.type] ?? item.type}</span>{" "}
                <span className="mono">{displayName(item.name)}</span>
                {item.count > 1 ? <span className="muted"> ×{item.count}</span> : null}
                {item.description ? (
                  <p className="muted item-description">{item.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
