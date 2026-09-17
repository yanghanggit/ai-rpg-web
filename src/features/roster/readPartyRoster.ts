import type { Schemas } from "../../api/types";
import { getComponentData } from "../entities/ecs";

/**
 * 从实体里读出 `PartyRosterComponent.members`。
 *
 * 组件查找走 `features/entities/ecs`（`data` 在契约里是 `Dict[str, Any]`，字段名写错
 * TypeScript 拦不住，只能运行时校验）。组件不存在（名单为空时后端会移除它）或形状不对
 * 一律返回空数组——「没有队伍」与「读不出来」在这里是同一个可接受结果。
 */
export function readPartyRoster(entity: Schemas["EntitySerialization"]): string[] {
  const members = getComponentData(entity, "PartyRosterComponent")?.members;
  if (!Array.isArray(members)) {
    return [];
  }
  return members.filter((member): member is string => typeof member === "string" && member !== "");
}
