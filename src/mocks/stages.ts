/**
 * mock 用的内存场景表。
 *
 * 真实后端里场景 → 角色的分布由 home pipeline 改写；mock 没有 pipeline，所以在 switch_stage 的
 * handler 里直接改这张表。行为对齐后端：玩家只出现在一个场景。
 */
import type { Schemas } from "../api/types";
import { COMPONENT } from "../features/entities/componentNames";
import type { Entity } from "../features/entities/ecs";
import {
  blueprintFixture,
  dungeonStageEntityFixtures,
  homeStagesFixture,
  stageEntityFixtures,
} from "./fixtures";

type ActorsByStage = Schemas["StagesStateResponse"]["actors_by_stage"];

function cloneActorsByStage(source: ActorsByStage): ActorsByStage {
  return Object.fromEntries(Object.entries(source).map(([stage, actors]) => [stage, [...actors]]));
}

let actorsByStage: ActorsByStage = cloneActorsByStage(homeStagesFixture.actors_by_stage);

/** 当前场景分布快照（深拷贝，调用方改不到内部状态）。 */
export function readMockStages(): Schemas["StagesStateResponse"] {
  return { actors_by_stage: cloneActorsByStage(actorsByStage) };
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
  const targetActors = actorsByStage[targetStage] ?? [];
  for (const actor of actors) {
    for (const names of Object.values(actorsByStage)) {
      const index = names.indexOf(actor);
      if (index !== -1) {
        names.splice(index, 1);
      }
    }
    targetActors.push(actor);
  }
  actorsByStage[targetStage] = targetActors;
}

/** 查找角色当前所在场景；不在任何场景时返回 `null`。 */
function findMockStageOfActor(actor: string): string | null {
  for (const [stage, actors] of Object.entries(actorsByStage)) {
    if (actors.includes(actor)) {
      return stage;
    }
  }
  return null;
}

/** 运行期生成的环境叙述（真后端由初始化管道写进 `EnvironmentComponent`）；key = 场景名。 */
let generatedNarratives = new Map<string, string>();

/**
 * 记下某场景新生成的环境叙述（开场初始化用）。
 *
 * 真后端这不是客户端做的：初始化管道跑完，场景实体的 `EnvironmentComponent` 就有了叙述，
 * 客户端只是重取实体。mock 没有 pipeline，所以在初始化 handler 里直接改这份表。
 */
export function markMockStageNarrative(stageName: string, narrative: string): void {
  generatedNarratives = new Map(generatedNarratives).set(stageName, narrative);
}

/** 复位成初始 fixture（测试之间隔离）。 */
export function resetMockStages(): void {
  actorsByStage = cloneActorsByStage(homeStagesFixture.actors_by_stage);
  generatedNarratives = new Map();
}

/** 场景实体快照（深拷贝）；未知场景名返回 `null`。家园与副本场景都在这里。 */
export function readMockStageEntity(name: string): Entity | null {
  const fixture = [...stageEntityFixtures, ...dungeonStageEntityFixtures].find(
    (entity) => entity.name === name,
  );
  if (fixture === undefined) {
    return null;
  }
  const entity = structuredClone(fixture);
  const narrative = generatedNarratives.get(name);
  if (narrative !== undefined) {
    entity.data[COMPONENT.Environment] = { name, narrative };
  }
  return entity;
}
