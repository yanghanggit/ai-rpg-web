/**
 * 生成默认玩家名：`player-YYYYMMDD-HHmmss-<8位随机十六进制>`。
 *
 * 用 `crypto.getRandomValues` 而不是 `randomUUID`（后者只在安全上下文存在，局域网 http 下会抛错）；
 * 8 位后缀是为了不让 URL 变长。后端接入真实身份后此函数应被取代。
 */

/** 随机后缀的十六进制位数（每 2 位 1 字节）。 */
const SUFFIX_HEX_LENGTH = 8;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 生成 8 位十六进制随机后缀（32 bit）。 */
function createRandomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SUFFIX_HEX_LENGTH / 2));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * @param now    用于确定时间部分；测试可注入固定时间。
 * @param suffix 随机后缀；测试可注入固定值。
 */
export function generatePlayerName(
  now: Date = new Date(),
  suffix: string = createRandomSuffix(),
): string {
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `player-${date}-${time}-${suffix}`;
}
