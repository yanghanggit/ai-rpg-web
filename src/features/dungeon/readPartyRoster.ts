import type { Schemas } from "../../api/types";

/**
 * 从实体里读出 `PartyRosterComponent.members`。
 *
 * 与 `identity/readActorInfo.ts` 同一写法：`ComponentSerialization.data` 是
 * `Dict[str, Any]`，字段名写错 TypeScript 拦不住，只能按组件名认出后逐字段校验。
 * 组件不存在（名单为空时后端会移除它）或形状不对一律返回空数组——
 * 「没有队伍」与「读不出来」在这里是同一个可接受结果。
 */
export function readPartyRoster(entity: Schemas["EntitySerialization"]): string[] {
  const data = entity.components.find(
    (component) => component.name === "PartyRosterComponent",
  )?.data;
  const members = data?.members;
  if (!Array.isArray(members)) {
    return [];
  }
  return members.filter((member): member is string => typeof member === "string" && member !== "");
}
