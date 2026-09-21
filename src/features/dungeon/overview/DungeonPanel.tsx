import { displayName } from "../../../components/displayName";
import { useDungeonList } from "./useDungeonList";

/**
 * 「可用副本」卡片区（静态模型数据）。
 *
 * 为什么用卡片而不是列表：这是**宏观信息**，卡片的边界让每个副本一眼可分，
 * 也避免在页面里开一个小窗口去滚动找内容。整体设定超出卡片高度就截断显示 `…`，
 * 点卡片主体打开 `DungeonInfoDialog` 看全文——与场景卡片「点开看详情」同一套心智。
 *
 * 卡片是「容器 + 主体按钮 + 操作行」：主体按钮占满剩余宽度（点哪里都能看详情），
 * 「进入副本」是**平级的兄弟按钮**——HTML 不允许 `button` 嵌套 `button`，
 * 所以不能让进入按钮长在主体按钮里面（与 `RosterPanel` 的角色卡片同一做法）。
 *
 * 栅格沿用全项目的响应式规则（`minmax(min(320px, 100%), 1fr)`）：
 * 窄屏单列、宽屏自动多列（见 docs/conventions.md「布局与响应式」）。
 */
export default function DungeonPanel({
  onSelect,
  onEnter,
  enterDisabled,
}: {
  /** 点卡片主体（查看详情）时回调。 */
  onSelect: (dungeonName: string) => void;
  /** 点「进入副本」时回调。 */
  onEnter: (dungeonName: string) => void;
  /** 已有副本进行中时禁用进入（后端会拒绝，进入前就拦住）。 */
  enterDisabled: boolean;
}) {
  const dungeons = useDungeonList();
  const list = dungeons.data ?? [];

  return (
    <section aria-labelledby="dungeon-list-heading">
      <div className="section-head">
        <h2 id="dungeon-list-heading">可用副本</h2>
      </div>

      {dungeons.isPending ? <p className="muted">加载中…</p> : null}
      {dungeons.isError ? (
        <p className="error">无法获取副本列表：{String(dungeons.error)}</p>
      ) : null}

      {dungeons.isSuccess ? (
        list.length === 0 ? (
          <p className="muted">（暂无副本，点上方「生成新副本」）</p>
        ) : (
          <ul className="dungeon-cards">
            {list.map((dungeon) => (
              <li key={dungeon.name}>
                <div className="dungeon-card">
                  <button
                    type="button"
                    className="dungeon-card-main"
                    aria-label={`查看副本：${displayName(dungeon.name)}`}
                    onClick={() => onSelect(dungeon.name)}
                  >
                    <span className="dungeon-card-head">
                      <span className="mono dungeon-card-name">{displayName(dungeon.name)}</span>
                      <span className="badge">{dungeon.rooms.length} 个房间</span>
                    </span>
                    <span className="muted dungeon-card-profile">{dungeon.profile}</span>
                  </button>

                  <div className="dungeon-card-actions">
                    <button
                      type="button"
                      disabled={enterDisabled}
                      title={enterDisabled ? "已有副本进行中，退出后才能进入新副本" : undefined}
                      aria-label={`进入副本：${displayName(dungeon.name)}`}
                      onClick={() => onEnter(dungeon.name)}
                    >
                      进入副本
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
