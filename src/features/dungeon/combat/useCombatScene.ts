/**
 * 战斗房间的「场景快照」：参战者名单 + 各人的战斗数据。
 *
 * 两步取数（与 `useDungeonParty` 同一手法，不需要新接口）：
 * 1. group 端点按 `PartyMemberComponent` 拿到**副本内的队伍**（进副本时固化，含玩家）；
 * 2. 参战者名单 = 队伍名 + 当前房间场景里的怪物名（`room.stage.actors` 里 `type=Monster`）。
 *    一次 details 把全部组件取回，再交给 `readCombatant` 解析。
 *
 * 为什么用「队伍 + 房间怪物名」而不是查 `stages/v1/state` 再找玩家所在场景：
 * 房间对象本身已经给出怪物，队伍查询又被 `invalidateEntitiesAndMessages` 覆盖，两者都随
 * 战斗动作刷新；而场景映射在 `advance_stage` 后并不会失效，直接依赖它会读到旧场景。
 * 参数名一律用**原始实体名**（比较 / API / key 都用原值，显示才走 `displayName`）。
 */
import { $api } from "../../../api/query";
import type { Schemas } from "../../../api/types";
import { COMPONENT } from "../../entities/componentNames";
import { hasComponent } from "../../entities/ecs";
import { readItems } from "../../items/readItems";
import type { Item } from "../../items/types";
import { type Combatant, readCombatant } from "./readCombat";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";
const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

export function useCombatScene(userName: string, gameName: string, room: Schemas["CombatRoom"]) {
  const party = $api.useQuery(
    "get",
    GROUP_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { all_of: [COMPONENT.PartyMember] },
      },
    },
    { select: (data) => data.entities.map((entity) => entity.name) },
  );

  // 战斗房间的 stage.actors 可能同时含队伍与怪物（后端会把参战者都挂到场景上），
  // 这里只取怪物，队伍一律以 group 的 PartyMemberComponent 为准，避免重复。
  const monsterNames = room.stage.actors
    .filter((actor) => actor.type === "Monster")
    .map((actor) => actor.name);
  const participantNames = [...(party.data ?? []), ...monsterNames];

  const details = $api.useQuery(
    "get",
    DETAILS_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { entities: participantNames },
      },
    },
    { enabled: participantNames.length > 0 },
  );

  const byName = new Map(details.data?.entities.map((entity) => [entity.name, entity]) ?? []);
  const combatants: Combatant[] = participantNames.flatMap((name) => {
    const entity = byName.get(name);
    return entity === undefined ? [] : [readCombatant(entity)];
  });

  // 结算页要看的玩家战利品（`LootComponent`）挂在玩家实体上，顺手从同一份 details 里读出来。
  const playerEntity = details.data?.entities.find((entity) =>
    hasComponent(entity, COMPONENT.Player),
  );
  const loot: Item[] =
    playerEntity === undefined ? [] : readItems(playerEntity.components, COMPONENT.Loot);

  return {
    combatants,
    loot,
    isPending: party.isPending || details.isPending,
    isError: party.isError || details.isError,
    error: party.error ?? details.error ?? null,
  };
}
