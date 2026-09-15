import { $api } from "../../api/query";

/**
 * 当前对局的蓝图。
 *
 * 蓝图是静态资源（同一份蓝图在会话期间不会变），从蓝图列表里按游戏名挑出对应那份。
 * 放在浮窗内按需调用：打开时才查，并 `staleTime: Infinity` 避免重复请求。
 */
export function useBlueprint(gameName: string) {
  return $api.useQuery("get", "/api/game/blueprint-list/v1/", undefined, {
    staleTime: Infinity,
    select: (data) => data.blueprints.find((blueprint) => blueprint.name === gameName) ?? null,
  });
}
