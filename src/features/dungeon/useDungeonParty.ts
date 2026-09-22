/**
 * **本次副本的队伍**：每个成员的战斗属性（`CharacterStatsComponent`）、牌组（`DeckComponent`）
 * 与奖励（`SpoilsComponent`）。
 *
 * 属于**副本**而不是"开场房"：队伍在进副本那一刻固化，开场房用它（角色卡上的属性 / `卡组 N` /
 * 奖励），标题行的「牌组」入口（`DeckBrowserDialog` 经 `useDungeonDecks`）在任何一屏都用它
 * ——所以它留在顶层。
 * 奖励只有开场房有（`SpoilsComponent` 只在开场房挂上），其余时候解析出来是 `null`。
 *
 * 两步取数（与 `useEnterPreview` 同一手法，不需要新接口）：
 * 1. group 端点按 `PartyMemberComponent` 拿到**副本内的队伍**——进副本那一刻固化，含玩家自己，
 *    之后不会变（家园接口在副本进行中一律被拒）；
 * 2. 一次 details 把各成员的全部组件取回，再按组件名解析出牌组与奖励。
 *
 * 牌组 / 奖励的解析复用 `features/cards`（「卡牌长什么样」的唯一实现，与 `features/items` 同构）。
 * 奖励用 `null` 表示**尚未生成**（组件不存在），与「生成了但是空的」区分开——界面据此决定
 * 还能不能点「生成奖励」。
 */
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";
import { readCards } from "../cards/readCards";
import type { Card } from "../cards/types";
import { COMPONENT } from "../entities/componentNames";
import { hasComponent, readCharacterStats } from "../entities/ecs";

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
    { select: (data) => data.entities.map((entity) => entity.name) },
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
  const byName = new Map(details.data?.entities.map((entity) => [entity.name, entity]) ?? []);
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
        deck: readCards(entity.components, COMPONENT.Deck),
        // `SpoilsComponent` 不存在 = 尚未生成奖励；存在则给出两个队列
        spoils: hasComponent(entity, COMPONENT.Spoils)
          ? {
              candidateCards: readCards(entity.components, COMPONENT.Spoils, "candidate_cards"),
              claimedCards: readCards(entity.components, COMPONENT.Spoils, "claimed_cards"),
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
