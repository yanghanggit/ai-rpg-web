/**
 * 会话的稳定标识（`user\0game`）。
 *
 * 用作「按会话隔离的客户端状态」的 key（目前是叙事未读基线）。用 `\0` 分隔是因为它
 * 不可能出现在用户名 / 游戏名里，两个字段拼起来不会撞；不要改成 `-` / `:` 这类分隔符。
 */
export function sessionKey(userName: string, gameName: string): string {
  return `${userName}\u0000${gameName}`;
}
