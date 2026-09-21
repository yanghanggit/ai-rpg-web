import { displayName } from "../../components/displayName";
import type { readDungeonInfo } from "./readDungeonInfo";

/** `readDungeonInfo` 整理出来的一行房间（浮窗与地图共用同一份数据形状）。 */
export type DungeonRoomInfo = ReturnType<typeof readDungeonInfo>["rooms"][number];

/** 一行房间 + 它在这一屏上的状态与动作。 */
export interface DungeonRoomRow {
  room: DungeonRoomInfo;
  /** 队伍所在的那一间：描边加重（浮窗与地图指的是同一件事）。 */
  current?: boolean;
  /** 行状态徐标（「当前所在」/「你在这里」/「已完成」…）；不给就没有。 */
  status?: string;
  /** 行尾那颗动作按钮（**只有地图给**：进入 / 前往下一间）；不给就是只读行。 */
  action?: {
    label: string;
    title: string;
    /** 动作进行中：禁用（推进覆盖"请求 + 重取"整段，见 `useAdvanceStage`）。 */
    busy?: boolean;
    onActivate: () => void;
  };
}

/**
 * 副本的房间清单（一列一间、从上往下读）。
 *
 * **「副本信息」浮窗与副本地图共用同一份行**——"地图就是它的可交互版"在这里是字面意思：
 * 差别只有行尾那颗动作按钮（地图给，浮窗不给）。所以行形状、徐标、敌人属性都只写这一处。
 *
 * 每行的第三列放动作按钮；只读调用方不给 `action`，那一列自然空着（`grid-template-columns` 是
 * `序号 | 内容 | 动作`）。将来地图支持"选路"时，长出来的就是"多行各带一颗按钮"。
 */
export default function DungeonRoomList({ rows }: { rows: DungeonRoomRow[] }) {
  return (
    <ol className="dungeon-rooms">
      {rows.map(({ room, current, status, action }, index) => (
        <li
          key={room.stageName}
          className={current === true ? "dungeon-room dungeon-room--current" : "dungeon-room"}
        >
          <span className="dungeon-room-index" aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <div className="dungeon-room-head">
              <span className="mono">{displayName(room.stageName)}</span>
              <span className={room.type === "combat" ? "badge badge--combat" : "badge"}>
                {room.typeLabel}
              </span>
              {status === undefined ? null : (
                <span className={current === true ? "badge badge--current" : "badge"}>
                  {status}
                </span>
              )}
            </div>
            {room.monsters.length === 0 ? null : (
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
          </div>
          {action === undefined ? null : (
            <button
              type="button"
              className="dungeon-room-action"
              title={action.title}
              disabled={action.busy === true}
              onClick={action.onActivate}
            >
              {action.label}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
