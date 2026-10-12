/**
 * 「进入副本」确认浮窗的取数编排：队伍 + 背包 + 名单都在一次 details 里取。
 *
 * details 依赖名单，所以等名单查询成功后再发。道具解析复用 `features/items` 的 `readItems`，
 * 不复制第二份。玩家排在队伍最前。
 */
import { $api } from "../../../api/query";
import { COMPONENT } from "../../entities/componentNames";
import { resolveEntities } from "../../entities/ecs";
import { readItems } from "../../items/readItems";
import { readPartyMember } from "../../roster/readPartyMember";
import { usePartyRoster } from "../../roster/usePartyRoster";

const DETAILS_PATH = "/api/entities/v1/{user_name}/{game_name}/details";

export function useEnterPreview(userName: string, gameName: string, playerActor: string) {
  const roster = usePartyRoster(userName, gameName);
  const memberNames = roster.data ?? [];

  // 玩家排在最前（队伍以「你」开头），名单里的重复项去掉
  const names = [playerActor, ...memberNames.filter((name) => name !== playerActor)];

  const details = $api.useQuery(
    "get",
    DETAILS_PATH,
    { params: { path: { user_name: userName, game_name: gameName }, query: { entities: names } } },
    { enabled: roster.isSuccess },
  );

  // 保持「玩家 → 名单顺序」，查不到的实体跳过
  const byName = new Map(
    resolveEntities(details.data?.entities ?? {}).map((entity) => [entity.name, entity]),
  );
  const party = names.flatMap((name) => {
    const entity = byName.get(name);
    return entity === undefined ? [] : [readPartyMember(entity)];
  });

  const playerEntity = byName.get(playerActor);

  return {
    party,
    inventory: playerEntity ? readItems(playerEntity, COMPONENT.Inventory) : [],
    isPending: roster.isPending || details.isPending,
    isError: roster.isError || details.isError,
    error: roster.error ?? details.error ?? null,
  };
}
