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
  let origin: string | null = null;

  for (const [stage, actors] of Object.entries(mapping)) {
    const index = actors.indexOf(player);
    if (index !== -1) {
      actors.splice(index, 1);
      origin = stage;
    }
  }

  const targetActors = mapping[targetStage] ?? [];
  targetActors.push(player);
  mapping[targetStage] = targetActors;
  return origin;
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
