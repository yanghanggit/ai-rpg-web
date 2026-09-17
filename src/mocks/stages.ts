/**
 * mock 用的内存场景表。
 *
 * 真实后端里，场景 → 角色的分布由 home pipeline 任务改写；mock 里没有 pipeline，
 * 所以在 switch_stage 的 handler 里直接改这份表，让「切换后玩家换个场景」可见。
 * 行为对齐后端：玩家只出现在一个场景，`readMockStages` 返回当前快照。
 */
import type { Schemas } from "../api/types";
import {
  blueprintFixture,
  dungeonStageEntityFixtures,
  homeStagesFixture,
  stageEntityFixtures,
} from "./fixtures";

type Mapping = Schemas["StagesStateResponse"]["mapping"];

function cloneMapping(source: Mapping): Mapping {
  return Object.fromEntries(Object.entries(source).map(([stage, actors]) => [stage, [...actors]]));
}

let mapping: Mapping = cloneMapping(homeStagesFixture.mapping);

/** 当前场景分布快照（深拷贝，调用方改不到内部状态）。 */
export function readMockStages(): Schemas["StagesStateResponse"] {
  return { mapping: cloneMapping(mapping) };
}

/** 把玩家移到目标场景，返回原场景；找不到玩家时返回 `null`。 */
export function moveMockPlayerToStage(targetStage: string): string | null {
  const player = blueprintFixture.player_actor;
  const origin = findMockStageOfActor(player);
  moveMockActorsToStage(targetStage, [player]);
  return origin;
}

/**
 * 把一组角色移动到目标场景（目标场景不存在时新建）。
 *
 * 真实后端改的是各实体的 `ActorComponent.current_stage`；进副本 / 推进到新房间时，
 * `./dungeons` 用它把队伍（与怪物）搬进当前场景。
 */
export function moveMockActorsToStage(targetStage: string, actors: readonly string[]): void {
  const targetActors = mapping[targetStage] ?? [];
  for (const actor of actors) {
    for (const names of Object.values(mapping)) {
      const index = names.indexOf(actor);
      if (index !== -1) {
        names.splice(index, 1);
      }
    }
    targetActors.push(actor);
  }
  mapping[targetStage] = targetActors;
}

/** 查找角色当前所在场景；不在任何场景时返回 `null`。 */
function findMockStageOfActor(actor: string): string | null {
  for (const [stage, actors] of Object.entries(mapping)) {
    if (actors.includes(actor)) {
      return stage;
    }
  }
  return null;
}

/** 复位成初始 fixture（测试之间隔离）。 */
export function resetMockStages(): void {
  mapping = cloneMapping(homeStagesFixture.mapping);
}

/** 场景实体快照（深拷贝）；未知场景名返回 `null`。家园与副本场景都在这里。 */
export function readMockStageEntity(name: string): Schemas["EntitySerialization"] | null {
  const fixture = [...stageEntityFixtures, ...dungeonStageEntityFixtures].find(
    (entity) => entity.name === name,
  );
  return fixture === undefined ? null : structuredClone(fixture);
}
