/**
 * 战斗房间的场景快照：参战者名单 + 各人战斗数据 + 玩家战利品。
 *
 * 参战者 = 队伍（`PartyMemberComponent`，进副本时固化）+ 当前房间的怪物名，再一次 details 解析。
 * 用房间对象取怪物（而不是查 stages/state），因为场景映射在 `advance_stage` 后不会失效。
 */
import { $api } from "../../../api/query";
import type { Schemas } from "../../../api/types";
import { COMPONENT } from "../../entities/componentNames";
import { hasComponent, resolveEntities } from "../../entities/ecs";
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
    { select: (data) => Object.keys(data.entities) },
  );

  // 房间的 stage.actors 可能同时含队伍与怪物，这里只取怪物（队伍一律以 group 的 PartyMember 为准）
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

  const byName = new Map(
    resolveEntities(details.data?.entities ?? {}).map((entity) => [entity.name, entity]),
  );
  const combatants: Combatant[] = participantNames.flatMap((name) => {
    const entity = byName.get(name);
    return entity === undefined ? [] : [readCombatant(entity)];
  });

  // 结算页要看的战利品（`LootComponent`）挂在玩家实体上，顺手从同一份 details 里读出
  const playerEntity = resolveEntities(details.data?.entities ?? {}).find((entity) =>
    hasComponent(entity, COMPONENT.Player),
  );
  const loot: Item[] = playerEntity === undefined ? [] : readItems(playerEntity, COMPONENT.Loot);

  return {
    combatants,
    loot,
    isPending: party.isPending || details.isPending,
    isError: party.isError || details.isError,
    error: party.error ?? details.error ?? null,
  };
}
