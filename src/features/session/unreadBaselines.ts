/**
 * 每个会话「已看」到哪——叙事未读的基线（key = `user\0game`）。
 *
 * 约束：**模块级**（必须活过路由切换，否则"离开这一屏期间到达的事件"表达不出来）；
 * **不落 localStorage**（刷新后重建基线）。理由见 docs/pages.md「叙事」。
 */
const baselines = new Map<string, number>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** 该会话的已看基线；从未建立过时为 `undefined`。 */
export function getUnreadBaseline(session: string): number | undefined {
  return baselines.get(session);
}

/** 记录该会话已看到第几条（消息总数）。值没变时不通知，避免无意义重渲染。 */
export function setUnreadBaseline(session: string, seen: number): void {
  if (baselines.get(session) === seen) {
    return;
  }
  baselines.set(session, seen);
  emit();
}

/** 订阅基线变化（`useSyncExternalStore` 用）。 */
export function subscribeUnreadBaseline(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 复位全部会话的基线（测试之间隔离；与 src/mocks 的 reset* 同一手法）。 */
export function resetUnreadBaselines(): void {
  baselines.clear();
  emit();
}
