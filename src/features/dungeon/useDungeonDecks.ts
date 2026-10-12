/**
 * 「牌组一览」的数据：我方队伍（复用 `useDungeonParty`）+ 本间场景里的怪物。
 *
 * 怪物名从房间模型 `room.stage.actors` 按 `type === "Monster"` 取（不能按 `MonsterComponent` 查
 * group：副本所有房间的怪物实体都已建出，会拉进别的房间的怪），再一次 details 读 `DeckComponent`。
 * 死的怪也列（房间模型是静态的）。
 */
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";
import { readCards } from "../cards/readCards";
import type { Card } from "../cards/types";
import { COMPONENT } from "../entities/componentNames";
import { resolveEntities } from "../entities/ecs";
import { useDungeonParty } from "./useDungeonParty";

const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

/** 当前房间（用来取本间怪物）；判别联合沿用生成物。 */
type DungeonRoom = Schemas["OpeningRoom"] | Schemas["CombatRoom"];

/** 怪物在「牌组一览」里的形状：名字 + 牌组（不需要属性 / 奖励）。 */
export interface DungeonMonster {
  name: string;
  deck: Card[];
}

export function useDungeonDecks(userName: string, gameName: string, room: DungeonRoom | null) {
  const party = useDungeonParty(userName, gameName);

  const monsterNames =
    room === null
      ? []
      : room.stage.actors.filter((actor) => actor.type === "Monster").map((actor) => actor.name);

  const details = $api.useQuery(
    "get",
    DETAILS_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { entities: monsterNames },
      },
    },
    { enabled: monsterNames.length > 0 },
  );

  const byName = new Map(
    resolveEntities(details.data?.entities ?? {}).map((entity) => [entity.name, entity]),
  );
  const monsters: DungeonMonster[] = monsterNames.flatMap((name) => {
    const entity = byName.get(name);
    return entity === undefined ? [] : [{ name, deck: readCards(entity, COMPONENT.Deck) }];
  });

  // details 被 disabled 时 `isPending` 恒为 true，不能直接并进来（否则开场房永远「加载中…」）
  const monstersPending = monsterNames.length > 0 && details.isPending;

  return {
    /** 我方队伍（含玩家，顺序同后端名单）。 */
    party: party.party,
    /** 本间怪物（静态模型顺序）。 */
    monsters,
    isPending: party.isPending || monstersPending,
    isError: party.isError || details.isError,
    error: party.error ?? details.error ?? null,
  };
}
