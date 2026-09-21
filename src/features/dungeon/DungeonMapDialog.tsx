import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import DungeonRoomList from "./DungeonRoomList";
import { readDungeonInfo } from "./readDungeonInfo";

/**
 * 「地图」浮窗（标题行旗子 ⚑）：把副本的模型数据整理成只读的一屏——整体设定 / 进度 / 创建时间 /
 * 房间清单（含敌人属性）。**地图页就是它的可交互版**（同一份 `DungeonRoomList` / `readDungeonInfo`）。
 *
 * 名字刻意不叫「副本信息」：那是个模糊词，而这一屏本质上就是**地图 / 当前状态**——队伍在哪一间、
 * 副本里还剩什么。纯展示，副本对象由调用方给。两个来源都是同一个 `Dungeon` 模型——副本总览页给
 * `useDungeonList` 里的静态副本，副本房间页给 `useDungeonRun` 的运行中副本。进度不另传参数：
 * `current_room_index` 就是副本模型自身的字段（见 `readDungeonInfo`）。
 *
 * 战斗的宏观状态与回合明细**不在这里**：那是战斗房 ⚙「副本操作」菜单里的「战斗信息」
 * （`combat/CombatInfoDialog`），跟"地图 / 当前状态"是两件事。
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
      {/* 一列一间、从上往下读。**行形状与副本地图是同一个组件**——地图就是它的可交互版，
          差别只有行尾那颗动作按钮（这里不给，是只读版）。 */}
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
