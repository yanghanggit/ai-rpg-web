import type { Schemas } from "../../api/types";

type Entity = Schemas["EntitySerialization"];

/**
 * 从场景实体的序列化数据里读出「场景信息浮窗」需要的字段。
 *
 * 与 `identity/readActorInfo.ts` 同一写法：`ComponentSerialization.data` 是
 * `Dict[str, Any]`，字段名写错 TypeScript 拦不住，只能按 name 认出组件后逐字段校验，
 * 不符合就返回 `null`（宁可少显示，也不猜）。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(data: unknown, key: string): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data[key];
  return typeof value === "string" && value !== "" ? value : null;
}

export function readStageInfo(entity: Entity) {
  const stage = entity.components.find((component) => component.name === "StageComponent")?.data;
  const environment = entity.components.find(
    (component) => component.name === "EnvironmentComponent",
  )?.data;

  return {
    // StageComponent 只有名字；缺失时退回实体名，保证有东西可显示
    name: readString(stage, "name") ?? entity.name,
    // 环境叙述由 AI 动态生成，可能尚未生成
    narrative: readString(environment, "narrative"),
  };
}
