/**
 * TanStack Query 的类型安全封装（openapi-react-query）。
 *
 * queryKey 固定为 `[method, path, params]`，便于按资源整体失效：
 * `$api.useMutation("post", "/api/home/advance/v1/")`、
 * `queryClient.invalidateQueries($api.queryOptions("get", "/api/..."))`。
 */
import createQueryClient from "openapi-react-query";
import { client } from "./client";

export const $api = createQueryClient(client);
