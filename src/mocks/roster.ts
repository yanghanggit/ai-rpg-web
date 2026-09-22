/**
 * mock 用的内存队伍名单状态（`PartyRosterComponent`）。
 *
 * 真实后端把队伍名单挂在**玩家实体**上：`PartyRosterComponent { name, members }`，
 * 名单为空时直接移除该组件（见 `services/home_actions.py`）。
 * add / remove 是**同步**动作，并有校验：成员必须是 NPC、不能重复、不能是玩家自身。
 * 这里照抄同一套语义，让 `pnpm dev:mock` 与真实后端行为一致。
 */
import type { Schemas } from "../api/types";
import { COMPONENT } from "../features/entities/componentNames";
import { npcEntityFixtures, playerEntityFixture } from "./fixtures";

/** 队伍成员（不含玩家自身）。 */
let roster: string[] = [];

/** 玩家实体的 `PartyRosterComponent` 快照；名单为空时组件不存在，返回空数组。 */
export function readMockRosterEntities(): Schemas["EntitySerialization"][] {
  if (roster.length === 0) {
    return [];
  }
  return [
    {
      name: playerEntityFixture.name,
      components: [
        {
          name: COMPONENT.PartyRoster,
          data: { name: playerEntityFixture.name, members: [...roster] },
        },
      ],
    },
  ];
}

/**
 * 候选同伴：持 `NPCComponent` 的实体。
 *
 * 这里特意把**玩家实体也当作一个「NPC 类型」的实体返回**（它的蓝图类型往往就是 NPC，
 * 所以真实后端会给它加上 `NPCComponent`）——这样调用方一旦忘了传
 * `none_of=PlayerComponent`，玩家就会出现在候选里，测试能当场抓住。
 */
export function readMockNpcEntities(excludeComponents: string[]): Schemas["EntitySerialization"][] {
  const withNpcMark: Schemas["EntitySerialization"][] = [
    {
      name: playerEntityFixture.name,
      components: [
        ...playerEntityFixture.components,
        { name: COMPONENT.NPC, data: { name: playerEntityFixture.name } },
      ],
    },
    ...npcEntityFixtures,
  ];

  return structuredClone(withNpcMark).filter(
    (entity) =>
      !excludeComponents.some((name) =>
        entity.components.some((component) => component.name === name),
      ),
  );
}

function isNpc(name: string): boolean {
  return npcEntityFixtures.some((entity) => entity.name === name);
}

/** 当前名单（不含玩家自身）。进副本时据此固化副本内队伍。 */
export function readMockRosterNames(): string[] {
  return [...roster];
}

export function addMockRosterMember(name: string): { ok: true } | { ok: false; error: string } {
  if (!isNpc(name)) {
    return { ok: false, error: `角色 ${name} 不是 NPC，无法加入队伍` };
  }
  if (roster.includes(name)) {
    return { ok: false, error: `${name} 已在队伍名单中` };
  }
  roster = [...roster, name];
  return { ok: true };
}

export function removeMockRosterMember(name: string): { ok: true } | { ok: false; error: string } {
  if (!roster.includes(name)) {
    return { ok: false, error: `${name} 不在队伍名单中` };
  }
  roster = roster.filter((member) => member !== name);
  return { ok: true };
}

/** 复位成空名单（测试之间隔离）。 */
export function resetMockRoster(): void {
  roster = [];
}
