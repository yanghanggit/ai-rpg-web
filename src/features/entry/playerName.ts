/**
 * 生成默认玩家名。
 *
 * 目前玩家名不可编辑，用「player-日期-时分」保证同一天多次进入也不重名。
 * 后端尚无玩家账号体系；将来接入真实身份后，此函数应被用户身份取代。
 */
export function generatePlayerName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `player-${date}-${time}`;
}
