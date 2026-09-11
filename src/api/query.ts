/**
 * TanStack Query 的类型安全封装（openapi-react-query）。
 *
 * 用法：
 *   $api.useQuery("get", "/api/stages/v1/{user_name}/{game_name}/state", {
 *     params: { path: { user_name, game_name } },
 *   })
 *   $api.useMutation("post", "/api/home/advance/v1/")
 *   queryClient.invalidateQueries($api.queryOptions("get", "/api/..."))
 *
 * queryKey 固定为 `[method, path, params]`，便于按资源整体失效。
 */
import createQueryClient from "openapi-react-query";
import { client } from "./client";

export const $api = createQueryClient(client);
