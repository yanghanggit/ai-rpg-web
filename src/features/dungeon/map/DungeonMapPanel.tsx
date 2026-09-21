import { useState } from "react";
import { useNavigate } from "react-router";
import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import { readDungeonInfo } from "../readDungeonInfo";
import { readRoomGuards } from "../readRoomGuards";
import { useAdvanceStage } from "../useAdvanceStage";
import { useDungeonRun } from "../useDungeonRun";
import AdvanceRoomDialog from "./AdvanceRoomDialog";

/**
 * 副本地图（`room.type` 无关）——**进行中副本的枢纽屏**：队伍在哪里、整局还剩几间。
 *
 * **地图是只读的，动作只有两个**（与"副本基本规律"一致：副本只向前，`current_room_index`
 * 只会 `+1`，没有任何接口能回退）：
 * 1. **前进**——本间没结束就是「进入房间」，本间结束了就是「前往下一间」；
 * 2. **离开副本**（在外层 `RoomScaffold` 的「副本操作」菜单里，本层不重复）。
 *
 * 这条两态机的几个后果都是**故意**的，不是遗漏：
 * - **房间没有出口**：房间页不提供"回到地图"，只有它自己的结束动作（见 `OpeningRoomPanel` /
 *   `CombatPostPanel`）。地图只在两个时刻出现——刚进入副本、以及某个房间结束时。
 * - **已结束的房间进不去**：本间一结束，"进入房间"这个动作就不再出现，于是那一间自然无法回头。
 *   代价是**未领的开场奖励 / 未收的战斗战利品会永久失去**（服务端把两者都硬绑在"当前房间"上：
 *   `activate_pick_spoils_card` 要求 `is_current_room_dungeon_opening`，`collect_loot` 要求
 *   `is_current_room_dungeon_combat`）——这是设计上要的惩罚，所以房间的结束动作会**提示**这件事，
 *   但不阻止（提示在房间里，因为只有那里有"还有多少没领"的数据）。
 * - **前进目标恒为唯一一间**：`rooms[current_room_index + 1]`。看着像"选择"，本质是一次确认，
 *   所以套 `AdvanceRoomDialog`（推进不可逆）。
 *
 * 屏幕切换一律 `replace`：副本内没有"后退"这个概念，只有前进和放弃离开（历史栈里不该留下
 * 可以倒退着回去的房间）。所以浏览器返回键不会让你从房间里溜到地图上。
 *
 * 能不能前进由 `readRoomGuards` 判（服务端两处房间检查的镜像），只用于**禁用与说明**；
 * 点下去后端仍会重新判一次。
 */
export default function DungeonMapPanel({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  /** 当前房间（`GET .../room`）：地图上"你在这里"的那一间。 */
  room: Schemas["DungeonRoomResponse"]["room"];
}) {
  const navigate = useNavigate();
  const run = useDungeonRun(userName, gameName);
  const advance = useAdvanceStage(userName, gameName);

  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);

  const guards = readRoomGuards(room);
  const dungeon = run.data?.dungeon ?? null;
  // 房间表来自 `/state`：拿到之前不知道有几间、下一间是谁，所以前进动作整块先不出现
  // （比“先画一个不知道能不能点的按钮”诚实）
  const loaded = dungeon !== null;
  const currentIndex = dungeon?.current_room_index ?? -1;
  const info = dungeon === null ? null : readDungeonInfo(dungeon);
  const rooms = info?.rooms ?? [];
  const progress = info?.progress ?? null;
  const nextRoom = dungeon === null ? null : (dungeon.rooms[currentIndex + 1] ?? null);

  const roomPath = `/game/${userName}/${gameName}/dungeon/room`;
  /** 唯一的前进条件：本间结束 + 没打输 + 还有下一间。 */
  const canAdvance = guards.done && !guards.defeated && nextRoom !== null;

  // 前进不可用时，把"为什么"写清楚（分别是"还没打完""打输了""已通关"三种不同的处境）
  const hint = !guards.done
    ? "本间尚未结束：进入房间把它打完，才能前往下一间。"
    : guards.defeated
      ? "战斗失败，无法推进——只能离开副本。"
      : nextRoom === null
        ? "副本已全部通关——用「副本操作」里的「离开副本」回家园。"
        : null;

  return (
    <>
      <section aria-labelledby="dungeon-map-heading">
        <div className="section-head">
          <h2 id="dungeon-map-heading">地图</h2>
          {progress === null ? null : <span className="muted">{progress}</span>}
        </div>

        {run.isPending ? <p className="muted">加载中…</p> : null}
        {run.isError ? (
          <p className="error">无法获取副本进度：{describeApiError(run.error)}</p>
        ) : null}

        <ol className="map-nodes">
          {rooms.map((node, index) => {
            const current = index === currentIndex;
            const status = current
              ? guards.done
                ? "你在这里（已结束）"
                : "你在这里"
              : index < currentIndex
                ? "已完成"
                : index === currentIndex + 1
                  ? "下一间"
                  : "未到达";

            return (
              <li
                key={node.stageName}
                className={current ? "map-node map-node--current" : "map-node"}
              >
                <span className="map-node-index" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <div className="dungeon-room-head">
                    <span className="mono">{displayName(node.stageName)}</span>
                    <span className={node.type === "combat" ? "badge badge--combat" : "badge"}>
                      {node.typeLabel}
                    </span>
                    <span className={current ? "badge badge--current" : "badge"}>{status}</span>
                  </div>
                  {node.monsters.length === 0 ? null : (
                    <ul className="plain dungeon-monsters">
                      {node.monsters.map((monster) => (
                        <li key={monster.name}>
                          <span className="mono">{displayName(monster.name)}</span>{" "}
                          <span className="muted">
                            HP {monster.character_stats.max_hp} · ATK{" "}
                            {monster.character_stats.attack} · DEF {monster.character_stats.defense}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {loaded ? (
        <>
          <div className="toolbar">
            {guards.done ? (
              <button type="button" disabled={!canAdvance} onClick={() => setIsAdvanceOpen(true)}>
                前往下一间
              </button>
            ) : (
              <button type="button" onClick={() => navigate(roomPath, { replace: true })}>
                进入房间
              </button>
            )}
          </div>
          {hint === null ? null : <p className="muted">{hint}</p>}
        </>
      ) : null}

      {isAdvanceOpen ? (
        <AdvanceRoomDialog
          currentRoomName={room.stage.name}
          nextRoom={nextRoom}
          busy={advance.isPending}
          error={advance.isError ? describeApiError(advance.error) : null}
          onConfirm={() =>
            advance.mutate(undefined, {
              // useAdvanceStage 已经等重取落地了，所以这里直接换屏，房间页拿到的是新房间
              onSuccess: () => navigate(roomPath, { replace: true }),
            })
          }
          onClose={() => {
            advance.reset();
            setIsAdvanceOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
