/** 服务器名字（`角色.无名`）→ 最后一段（`无名`）。**只用于显示**；比较 / URL / key 一律用原名。 */
export function displayName(name: string): string {
  const segments = name.split(".").filter((segment) => segment !== "");

  return segments[segments.length - 1] ?? name;
}
