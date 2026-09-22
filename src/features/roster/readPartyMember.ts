import type { Schemas } from "../../api/types";
import { COMPONENT } from "../entities/componentNames";
import { hasComponent, readCharacterStats } from "../entities/ecs";

type Entity = Schemas["EntitySerialization"];

/**
 * 从角色实体里读出「出征前点验」需要的信息：是不是玩家本人、是否已死亡、战斗属性。
 *
 * 组件存在性与属性解析统一走 `features/entities/ecs`（读不出来就返回 `null`，
 * 宁可少显示，也不猜）。`DeathComponent` 只有有无之分（后端把死亡当标记），
 * 所以只判存在性——它决定了「能不能进副本」：后端 `enter_dungeon` 会断言队伍成员都没死，
 * 否则整个请求 500。
 */
export function readPartyMember(entity: Entity) {
  return {
    name: entity.name,
    player: hasComponent(entity, COMPONENT.Player),
    dead: hasComponent(entity, COMPONENT.Death),
    stats: readCharacterStats(entity),
  };
}
