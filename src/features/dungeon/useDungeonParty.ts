/**
 * 本次副本的队伍：每个成员的战斗属性、牌组、奖励（`SpoilsComponent`，`null` 表示尚未生成）。
 *
 * 队伍在进副本那一刻固化，标题行的「牌组」入口在任何一屏都用它，所以留在顶层。
 * 两步取数：group 按 `PartyMemberComponent` 拿队伍名 → details 取组件。
 */
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";
import { readCards } from "../cards/readCards";
import type { Card } from "../cards/types";
import { COMPONENT } from "../entities/componentNames";
import { hasComponent, readCharacterStats, resolveEntities } from "../entities/ecs";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";
const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

export interface DungeonPartyMember {
  name: string;
  /** 是不是玩家控制的角色（界面标「（你）」）。 */
  player: boolean;
  /** 战斗属性（`CharacterStatsComponent`）；读不出来给 `null`，宁可少显示也不猜。 */
  stats: Schemas["CharacterStats"] | null;
  deck: Card[];
  /** `null` = 尚未生成奖励（Spoils）；否则给出两个队列：待领取候选与已领取。 */
  spoils: { candidateCards: Card[]; claimedCards: Card[] } | null;
}

export type DungeonParty = ReturnType<typeof useDungeonParty>;

export function useDungeonParty(userName: string, gameName: string) {
  const members = $api.useQuery(
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

  // 实体名来自上一步，所以等它成功再发（避免用空名单先发一次无用请求）
  const details = $api.useQuery(
    "get",
    DETAILS_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { entities: members.data ?? [] },
      },
    },
    { enabled: members.isSuccess },
  );

  // 保持队伍顺序（玩家在前、其余同名单），查不到的实体跳过
  const byName = new Map(
    resolveEntities(details.data?.entities ?? {}).map((entity) => [entity.name, entity]),
  );
  const party: DungeonPartyMember[] = (members.data ?? []).flatMap((name) => {
    const entity = byName.get(name);
    if (entity === undefined) {
      return [];
    }
    return [
      {
        name,
        player: hasComponent(entity, COMPONENT.Player),
        stats: readCharacterStats(entity),
        deck: readCards(entity, COMPONENT.Deck),
        // `SpoilsComponent` 不存在 = 尚未生成奖励；存在则给出两个队列
        spoils: hasComponent(entity, COMPONENT.Spoils)
          ? {
              candidateCards: readCards(entity, COMPONENT.Spoils, "candidate_cards"),
              claimedCards: readCards(entity, COMPONENT.Spoils, "claimed_cards"),
            }
          : null,
      },
    ];
  });

  return {
    party,
    isPending: members.isPending || details.isPending,
    isError: members.isError || details.isError,
    error: members.error ?? details.error ?? null,
  };
}
