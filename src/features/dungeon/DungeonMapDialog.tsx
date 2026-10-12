import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import DungeonRoomList from "./DungeonRoomList";
import { readDungeonInfo } from "./readDungeonInfo";

/**
 * 「地图」浮窗（标题行 ⚑）：把副本模型整理成只读一屏——设定 / 进度 / 创建时间 / 房间清单。
 * 地图页是它的可交互版（同一份 `DungeonRoomList` / `readDungeonInfo`）。纯展示，副本对象由调用方给。
 */
export default function DungeonMapDialog({
  dungeon,
  onClose,
}: {
  dungeon: Schemas["Dungeon"];
  onClose: () => void;
}) {
  const info = readDungeonInfo(dungeon);

  return (
    <Modal title="地图" meta={displayName(dungeon.name)} size="lg" onClose={onClose}>
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
      {/* 行形状与副本地图是同一个组件；这里不给动作按钮，就是只读版 */}
      <DungeonRoomList
        rows={info.rooms.map((room) => ({
          room,
          current: room.isCurrent,
          status: room.isCurrent ? "当前所在" : undefined,
        }))}
      />
    </Modal>
  );
}
