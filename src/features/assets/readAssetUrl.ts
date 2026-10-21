import { apiUrl } from "../../api/client";

/** 后端 meta 文件的后缀（`.assets/image/<file>.png.meta` 与 raw 文件成对存在）。 */
const META_SUFFIX = ".meta";

/**
 * 资产 URL：持有方在 `assets` 里存的是**元数据路径**（`.assets/image/<file>.png.meta`），访问 URL 由
 * filename + 服务端给的 `assets_url_prefix` 推出（规则同后端 `models/assets_meta.py` 的 `asset_url()`）。
 *
 * 取不到（没有该资产 / 前缀还没到）返回 `null`：宁可不出图，也不猜一个地址挂 broken image。
 */
export function readAssetUrl(
  assets: Record<string, string> | undefined,
  key: string,
  assetsUrlPrefix: string | null,
): string | null {
  const metaPath = assets?.[key];
  if (metaPath === undefined || metaPath === "" || assetsUrlPrefix === null) {
    return null;
  }
  const filename = metaPath.split("/").at(-1) ?? "";
  if (filename === "") {
    return null;
  }
  return apiUrl(`${assetsUrlPrefix}/${filename.replace(META_SUFFIX, "")}`);
}
