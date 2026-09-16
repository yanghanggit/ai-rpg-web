/**
 * 每个会话「已看」到哪（叙事未读的基线）。
 *
 * 为什么放在**模块级**而不是组件 state（也不是 Provider）：家园页与副本房间页是两个路由，
 * 切换时页面组件会卸载，而「未读」表达的正是「你离开这一屏期间新到的事件」。基线必须活得
 * 比任何一屏久，才能在从家园 → 副本 → 家园之后仍记得你上次看到第几条。
 *
 * 刻意**不**落 localStorage：刷新页面即重新建立基线。当前开发阶段不引入跨刷新的持久化
 * （见 docs/pages.md「叙事」）。按会话（`user\0game`）为 key，切局会自动重新建基线。
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
