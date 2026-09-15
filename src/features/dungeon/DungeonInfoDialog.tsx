import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { readDungeonInfo } from "./readDungeonInfo";
import { useDungeonList } from "./useDungeonList";

/** 房间类型（判别字段 `room.type`）→ 界面说法。未知类型显示原值：不猜。 */
const ROOM_TYPE_LABELS: Record<string, string> = {
  opening: "探索",
  combat: "战斗",
};

/**
 * 副本信息浮窗：只展示**静态模型数据**（整体设定 / 创建时间 / 房间 / 敌人属性），
 * 对应 TUI 的 `/dungeon @副本名`。
 *
 * 副本对象从 `useDungeonList` 的缓存里按名字取——后端没有「查单个副本」的接口，
 * 列表就是唯一数据源，与列表共用同一条查询，不额外发请求。
 */
export default function DungeonInfoDialog({
  dungeonName,
  onClose,
}: {
  /** 副本原始名（`副本.荒村义庄`）。 */
  dungeonName: string;
  onClose: () => void;
}) {
  const dungeons = useDungeonList();
  const dungeon = dungeons.data?.find((item) => item.name === dungeonName);
  const info = dungeon ? readDungeonInfo(dungeon) : null;

  return (
    <Modal title="副本信息" meta={displayName(dungeonName)} onClose={onClose}>
      {dungeons.isPending ? <p className="muted">加载中…</p> : null}
      {dungeons.isError ? (
        <p className="error">无法获取副本数据：{String(dungeons.error)}</p>
      ) : null}
      {dungeons.isSuccess && !info ? <p className="error">列表里没有这个副本。</p> : null}

      {info ? (
        <>
          <p>{info.profile}</p>

          <dl className="facts">
            <dt>房间数</dt>
            <dd>{info.rooms.length}</dd>
            {info.createdAt ? (
              <>
                <dt>创建时间</dt>
                <dd className="mono">{info.createdAt}</dd>
              </>
            ) : null}
          </dl>

          <h3>房间</h3>
          <ol className="dungeon-rooms">
            {info.rooms.map((room) => (
              <li key={room.stageName}>
                <div className="dungeon-room-head">
                  <span className="mono">{displayName(room.stageName)}</span>
                  <span className={room.type === "combat" ? "badge badge--combat" : "badge"}>
                    {ROOM_TYPE_LABELS[room.type] ?? room.type}
                  </span>
                </div>
                {room.monsters.length === 0 ? (
                  <p className="muted">（无敌人）</p>
                ) : (
                  <ul className="plain dungeon-monsters">
                    {room.monsters.map((monster) => (
                      <li key={monster.name}>
                        <span className="mono">{displayName(monster.name)}</span>{" "}
                        <span className="muted">
                          HP {monster.character_stats.max_hp} · ATK {monster.character_stats.attack}{" "}
                          · DEF {monster.character_stats.defense}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </Modal>
  );
}
