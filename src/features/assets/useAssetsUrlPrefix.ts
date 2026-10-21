import { $api } from "../../api/query";

/**
 * 静态资产的 URL 前缀（`GET /` 的 `assets_url_prefix`，如 `/assets/image`）。
 *
 * 与启动屏共用同一个查询（key 相同，切屏不重取）；拿不到就返回 `null`——调用方据此不出图，
 * 不在客户端写死前缀。
 */
export function useAssetsUrlPrefix(): string | null {
  const info = $api.useQuery("get", "/", {}, { staleTime: Number.POSITIVE_INFINITY });
  return info.data?.assets_url_prefix ?? null;
}
