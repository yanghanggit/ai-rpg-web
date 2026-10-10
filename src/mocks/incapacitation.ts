/**
 * mock 用的「已永久失能」标记（`IncapacitatedComponent`）。
 *
 * 真实后端里失能由家园 pipeline 判定后挂组件；mock 没有 pipeline，所以这里用一份内存集合
 * 表达「谁失能了」，再在 actor / NPC 候选 / group / details 各处把它注入成组件，让前端的
 * 失能展示（角色信息浮窗、场景 chip、候选过滤、出征点验）在 `pnpm dev:mock` 下能真正走到。
 *
 * 默认是**空集**——不改变既有 fixtures 的组成（否则会污染大量对角色列表 / 人数的断言）。
 * 造状态有两个入口：深链种子 `?seed=home:incapacitated`，或测试里直接 `markMockIncapacitated`。
 */
import { COMPONENT } from "../features/entities/componentNames";
import { type Entity, isRecord } from "../features/entities/ecs";

let incapacitated = new Set<string>();

/** 把某角色标记为永久失能（幂等）。 */
export function markMockIncapacitated(name: string): void {
  incapacitated.add(name);
}

/** 该角色是否已在 mock 里被标为失能。 */
export function isMockIncapacitated(name: string): boolean {
  return incapacitated.has(name);
}

/** 把失能标记注入实体数据（未标记则原样返回，不复制，避免无谓开销）。
 *
 * 同时把 `stats.lives` 改成 0——失能与「剩余生命为 0」在真实数据里是因果一体的，
 * mock 里也保持一致，否则会出现「已失能但显示剩余生命 3」的诡异画面。
 */
export function withMockIncapacitation(entity: Entity): Entity {
  if (!incapacitated.has(entity.name)) {
    return entity;
  }
  const data: Entity["data"] = {
    ...entity.data,
    [COMPONENT.Incapacitated]: { name: entity.name },
  };
  const statsComponent = entity.data[COMPONENT.CharacterStats];
  if (isRecord(statsComponent) && isRecord(statsComponent.stats)) {
    data[COMPONENT.CharacterStats] = {
      ...statsComponent,
      stats: { ...statsComponent.stats, lives: 0 },
    };
  }
  return { ...entity, data };
}

/** 已失能角色名快照（group 查询用）。 */
export function readMockIncapacitatedNames(): string[] {
  return [...incapacitated];
}

/** 复位成空集（测试之间隔离）。 */
export function resetMockIncapacitation(): void {
  incapacitated = new Set<string>();
}
