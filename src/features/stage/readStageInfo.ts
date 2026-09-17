import type { Schemas } from "../../api/types";
import { getComponentData, readString } from "../entities/ecs";

type Entity = Schemas["EntitySerialization"];

/**
 * 从场景实体的序列化数据里读出「场景信息浮窗」需要的字段。
 *
 * 组件查找 / 字段读取统一走 `features/entities/ecs`（`data` 在契约里是 `Dict[str, Any]`，
 * 字段名写错 TypeScript 拦不住，只能运行时校验）；读不出来就返回 `null`（宁可少显示，也不猜）。
 */
export function readStageInfo(entity: Entity) {
  const stage = getComponentData(entity, "StageComponent");
  const environment = getComponentData(entity, "EnvironmentComponent");

  return {
    // StageComponent 只有名字；缺失时退回实体名，保证有东西可显示
    name: readString(stage, "name") ?? entity.name,
    // 环境叙述由 AI 动态生成，可能尚未生成
    narrative: readString(environment, "narrative"),
  };
}
