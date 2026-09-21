/**
 * 「进入副本」确认浮窗的取数编排。
 *
 * 点验需要三样东西，而它们**在一次 details 里就能全拿到**（后端 `serialize_entities`
 * 返回实体的全部组件）：
 * - 队伍：玩家 + `PartyRosterComponent.members` 逐个角色实体 → `features/roster` 的 `readPartyMember`；
 * - 背包：玩家实体的 `InventoryComponent`；
 * - 名单本身：`features/roster` 的 `usePartyRoster`。
 *
 * details 的实体名依赖名单，所以等名单查询成功后再发（与 `items/useItemContainers`
 * 等储物箱名字解析出来再查 details 是同一个模式），避免用空名单先发一次无用请求。
 *
 * 道具的读取复用 `features/items` 的 `readItems`：`InventoryComponent` 的解析规则
 * 只该有一份，复制第二份等于把「读 `ComponentSerialization.data`」这件事写错两次的机会翻倍
 * （单向依赖，items 不依赖 dungeon，不构成环）。见 docs/conventions.md 三。
 */
import { $api } from "../../../api/query";
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

  // 保持「玩家 → 名单顺序」，不重新排序；查不到的实体直接跳过（名字失效时页面还能用）
  const byName = new Map(details.data?.entities.map((entity) => [entity.name, entity]) ?? []);
  const party = names.flatMap((name) => {
    const entity = byName.get(name);
    return entity === undefined ? [] : [readPartyMember(entity)];
  });

  const playerEntity = byName.get(playerActor);

  return {
    party,
    inventory: playerEntity ? readItems(playerEntity.components, "InventoryComponent") : [],
    isPending: roster.isPending || details.isPending,
    isError: roster.isError || details.isError,
    error: roster.error ?? details.error ?? null,
  };
}
