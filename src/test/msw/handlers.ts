/**
 * MSW handler 的公共工具。
 */
import { API_BASE_URL } from "../../api/client";

/** 把后端相对路径补成完整 URL，供 MSW handler 匹配。 */
export function api(path: string): string {
  return `${API_BASE_URL}${path}`;
}
