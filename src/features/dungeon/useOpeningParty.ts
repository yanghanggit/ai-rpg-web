/**
 * 副本开场的**队伍状态**：每个成员的牌组（`DeckComponent`）与卡池（`SpoilsComponent`）。
 *
 * 两步取数（与 `useEnterPreview` 同一手法，不需要新接口）：
 * 1. group 端点按 `PartyMemberComponent` 拿到**副本内的队伍**——进副本那一刻固化，含玩家自己，
 *    之后不会变（家园接口在副本进行中一律被拒）；
 * 2. 一次 details 把各成员的全部组件取回，再按组件名解析出牌组与卡池。
 *
 * 牌组 / 卡池的解析复用 `features/cards`（「卡牌长什么样」的唯一实现，与 `features/items` 同构）。
 * 卡池用 `null` 表示**尚未生成**（组件不存在），与「生成了但是空的」区分开——界面据此决定
 * 还能不能点「生成卡池」。
 */
import { $api } from "../../api/query";
import { readCards } from "../cards/readCards";
import type { Card } from "../cards/types";

const GROUP_PATH = "/api/entities/v1/{user_name}/{game_name}/group";
const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

export interface OpeningPartyMember {
  name: string;
  /** 是不是玩家控制的角色（界面标「（你）」）。 */
  player: boolean;
  deck: Card[];
  /** `null` = 尚未生成卡池。 */
  pool: Card[] | null;
}

export function useOpeningParty(userName: string, gameName: string) {
  const members = $api.useQuery(
    "get",
    GROUP_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { all_of: ["PartyMemberComponent"] },
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
  const party: OpeningPartyMember[] = (members.data ?? []).flatMap((name) => {
    const entity = byName.get(name);
    if (entity === undefined) {
      return [];
    }
    const hasPool = entity.components.some((component) => component.name === "SpoilsComponent");
    return [
      {
        name,
        player: entity.components.some((component) => component.name === "PlayerComponent"),
        deck: readCards(entity.components, "DeckComponent"),
        pool: hasPool ? readCards(entity.components, "SpoilsComponent") : null,
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
