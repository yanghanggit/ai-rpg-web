/**
 * 生成默认玩家名。
 *
 * 格式：`player-YYYYMMDD-HHmmss-<8位随机十六进制>`，例：`player-20260911-130123-9f8e7d6c`
 *
 * 两个刻意的选择：
 * 1. 随机后缀用 `crypto.getRandomValues`，**不用** `crypto.randomUUID()`。
 *    randomUUID 只在安全上下文（https / localhost）存在；局域网 `http://192.168.x.x`
 *    下它是 `undefined`，会直接抛错。getRandomValues 在所有上下文都可用（已实测）。
 * 2. 后缀用 8 位（32 bit）而非完整 UUID。玩家名会进入 URL 路径
 *    （`/game/:userName/:gameName/home`），完整 UUID 会把 URL 拖到 60+ 字符；
 *    结合秒级时间戳，8 位随机已足够避免重名。
 *
 * 后端尚无玩家账号体系；将来接入真实身份后，此函数应被用户身份取代。
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
