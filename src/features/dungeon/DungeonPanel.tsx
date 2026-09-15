import { displayName } from "../../components/displayName";
import { useDungeonList } from "./useDungeonList";

/**
 * 「可用副本」卡片区（静态模型数据）。
 *
 * 为什么用卡片而不是列表：这是**宏观信息**，卡片的边界让每个副本一眼可分，
 * 也避免在页面里开一个小窗口去滚动找内容。整体设定超出卡片高度就截断显示 `…`，
 * 点整张卡片打开 `DungeonInfoDialog` 看全文——与场景卡片「点开看详情」同一套心智。
 *
 * 栅格沿用全项目的响应式规则（`minmax(min(320px, 100%), 1fr)`）：
 * 窄屏单列、宽屏自动多列（见 docs/conventions.md「布局与响应式」）。
 */
export default function DungeonPanel({ onSelect }: { onSelect: (dungeonName: string) => void }) {
  const dungeons = useDungeonList();
  const list = dungeons.data ?? [];

  return (
    <section aria-labelledby="dungeon-list-heading">
      <div className="section-head">
        <h2 id="dungeon-list-heading">可用副本</h2>
        <span className="muted">服务器上已生成的副本 · 点卡片查看静态数据</span>
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
                <button
                  type="button"
                  className="dungeon-card"
                  aria-label={`查看副本：${displayName(dungeon.name)}`}
                  onClick={() => onSelect(dungeon.name)}
                >
                  <span className="dungeon-card-head">
                    <span className="mono dungeon-card-name">{displayName(dungeon.name)}</span>
                    <span className="badge">{dungeon.rooms.length} 个房间</span>
                  </span>
                  <span className="muted dungeon-card-profile">{dungeon.profile}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
