import { displayName } from "../../../components/displayName";
import { useDungeonList } from "./useDungeonList";

/**
 * 「可用副本」卡片区（静态模型数据）：卡片主体点开 `DungeonMapDialog`，「进入副本」是平级兄弟按钮
 * （HTML 不允许 button 嵌套 button）。整体设定超出卡片高度就截断。
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
