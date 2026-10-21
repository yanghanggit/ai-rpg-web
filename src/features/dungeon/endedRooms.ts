/**
 * 「本间已经结束过」——纯客户端的房间生命周期状态（服务端没有这个字段）。
 *
 * 用途：地图上那一行给「进入房间」还是「前往下一间」（`readRoomGuards` 的第二个参数）。
 * 约束：模块级、不落 localStorage（刷新后算"还没进过"，重进是安全的）；换一局必须清空
 * （`useEnterDungeon` / `useExitDungeon`），否则同名关卡会带着上一局的账。
 * 理由与代价见 docs/pages.md「副本进行中」。
 */
const ended = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** 房间在这一局里的 key（`user\0game\0stage`）：同一个关卡在不同会话里互不相干。 */
export function endedRoomKey(userName: string, gameName: string, stageName: string): string {
  return `${userName}\u0000${gameName}\u0000${stageName}`;
}

/** 这一间结束过没有（没记过 = 还没进过）。 */
export function isRoomEnded(key: string): boolean {
  return ended.has(key);
}

/** 记下"本间结束"（幂等）。 */
export function markRoomEnded(key: string): void {
  if (ended.has(key)) {
    return;
  }
  ended.add(key);
  emit();
}

/** 订阅变化（`useSyncExternalStore` 用）。 */
export function subscribeEndedRooms(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 清空（新一局开始 / 本局结束；测试之间也用它隔离）。 */
export function clearEndedRooms(): void {
  if (ended.size === 0) {
    return;
  }
  ended.clear();
  emit();
}
