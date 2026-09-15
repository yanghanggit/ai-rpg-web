import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import { readDungeonInfo } from "./readDungeonInfo";

/**
 * 副本信息浮窗：展示副本的模型数据（整体设定 / 进度 / 创建时间 / 房间 / 敌人属性），
 * 对应 TUI 的 `/dungeon @副本名`。
 *
 * **纯展示**：副本对象由调用方给。两个来源都是同一个 `Dungeon` 模型——
 * 副本总览页给 `useDungeonList` 里的静态副本，副本房间页给 `useDungeonRun` 的运行中副本。
 * 进度不另传参数：`current_room_index` 就是副本模型自身的字段（见 `readDungeonInfo`）。
 */
export default function DungeonInfoDialog({
  dungeon,
  onClose,
}: {
  dungeon: Schemas["Dungeon"];
  onClose: () => void;
}) {
  const info = readDungeonInfo(dungeon);

  return (
    <Modal title="副本信息" meta={displayName(dungeon.name)} onClose={onClose}>
      <p>{info.profile}</p>

      <dl className="facts">
        <dt>房间数</dt>
        <dd>{info.rooms.length}</dd>
        {info.progress ? (
          <>
            <dt>进度</dt>
            <dd>{info.progress}</dd>
          </>
        ) : null}
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
                {room.typeLabel}
              </span>
              {room.isCurrent ? <span className="badge card-current-badge">当前所在</span> : null}
            </div>
            {room.monsters.length === 0 ? (
              <p className="muted">（无敌人）</p>
            ) : (
              <ul className="plain dungeon-monsters">
                {room.monsters.map((monster) => (
                  <li key={monster.name}>
                    <span className="mono">{displayName(monster.name)}</span>{" "}
                    <span className="muted">
                      HP {monster.character_stats.max_hp} · ATK {monster.character_stats.attack} ·
                      DEF {monster.character_stats.defense}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Modal>
  );
}
