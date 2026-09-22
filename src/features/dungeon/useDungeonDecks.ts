/**
 * 「牌组一览」的数据：我方队伍 + **本间**场景里的怪物。
 *
 * 两步取数（与 `combat/useCombatScene.ts` 同一手法，不新增接口）：
 * 1. 我方直接复用 `useDungeonParty`（`PartyMemberComponent`，进副本时固化，含牌组）；
 * 2. 本间怪物名从**房间模型** `room.stage.actors` 里按 `type === "Monster"` 取。
 *    不直接 `group?all_of=MonsterComponent`：后端 `setup_dungeon`（`dungeon_setup_action.py` 第 6 步）
 *    会把副本**所有房间**的怪物实体一次性建出来，而 group 端点只按组件过滤、不按 stage 过滤，
 *    那样会把别的房间的怪也拉进来。以房间模型为界，与后端 `get_alive_monsters_in_stage`
 *    （按锚点实体的 `current_stage` 过滤）落在同一个位置切片上。
 * 3. 对怪物名一次 details 取回组件，再读 `DeckComponent`（怪物与队伍一样持牌库）。
 *
 * **死的怪也列**：`room.stage.actors` 是静态模型，死亡的怪不会从模型里消失；只要 details
 * 查得到就把它的牌组列出来（对齐 TUI `cmd_combat.py::build_deck_text` 全列双方的口径，
 * 这里不按 `DeathComponent` 过滤）。
 */
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";
import { readCards } from "../cards/readCards";
import type { Card } from "../cards/types";
import { COMPONENT } from "../entities/componentNames";
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

  const byName = new Map(details.data?.entities.map((entity) => [entity.name, entity]) ?? []);
  const monsters: DungeonMonster[] = monsterNames.flatMap((name) => {
    const entity = byName.get(name);
    return entity === undefined
      ? []
      : [{ name, deck: readCards(entity.components, COMPONENT.Deck) }];
  });

  // 没有本间怪物时 details 是 disabled 的——v5 里 disabled 查询的 `isPending` 恒为 true，
  // 不能直接并进来，否则开场房会永远停在「加载中…」。
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
