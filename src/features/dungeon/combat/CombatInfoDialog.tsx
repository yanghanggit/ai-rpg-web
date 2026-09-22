import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import Modal from "../../../components/Modal";
import CombatRoundLog from "./CombatRoundLog";
import { COMBAT_RESULT_LABELS, COMBAT_STATE_LABELS } from "./combatPhase";
import type { Combatant } from "./readCombat";
import { useCombatScene } from "./useCombatScene";

/** 把后端给的角色名列表拼成一行（原始名过一遍 `displayName`）。空列表显示「—」。 */
function nameList(names: string[]): string {
  return names.length === 0 ? "—" : names.map(displayName).join(" → ");
}

/** 单回合的元数据（行动顺序 / 已完成 / 当前行动 / 动作次数）；日志与叙事交给 `CombatRoundLog`。 */
function RoundFacts({ index, round }: { index: number; round: Schemas["Round"] }) {
  const current = round.current_actor;
  return (
    <>
      <h4>
        第 {index + 1} 回合{" "}
        <span className="muted">
          · {round.is_completed ? "已结束" : "进行中"} ·{" "}
          {round.draw_completed ? "已抓牌" : "未抓牌"}
        </span>
      </h4>
      <dl className="facts">
        <dt>行动顺序</dt>
        <dd>{nameList(round.action_order)}</dd>
        <dt>已完成</dt>
        <dd>{nameList(round.completed_actors)}</dd>
        {current === null || current === undefined ? null : (
          <>
            <dt>当前行动</dt>
            <dd>{displayName(current)}</dd>
          </>
        )}
        <dt>消耗品 / 装备</dt>
        <dd>
          {round.consumable_use_count} / {round.gear_equip_count}
        </dd>
      </dl>
      <CombatRoundLog round={round} />
    </>
  );
}

/**
 * 一阵营一段名单（只读）：名字**横着排、自动换行**，战死的名字置灰 + 挂一颗「已战死」。
 *
 * 宏观信息只要"谁在场、谁死了"——名字 + 生死标记就够，**不铺血量攻防 / 能量 / 牌堆那一套**
 * （那是行动面板的事，而且每回合都在变）。也**不标"当前行动"**：下面「全部回合」里那条
 * `当前行动` 本来就从 `Round` 读出来，再挂一个会过期的说法是同一个信息说两遍。
 * 没人就不出这一段（与「牌组一览」同）。
 */
function CampSection({ label, members }: { label: string; members: Combatant[] }) {
  if (members.length === 0) {
    return null;
  }
  return (
    <section className="camp-section">
      <h4>{label}</h4>
      <ul className="camp-names">
        {members.map((combatant) => (
          <li
            key={combatant.name}
            className={combatant.dead ? "camp-name camp-name--dead" : "camp-name"}
          >
            <span>{displayName(combatant.name)}</span>
            {combatant.dead ? <span className="badge badge--dead">已战死</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 「战斗信息」浮窗：把战斗的宏观状态、**双方参战者**与**全部回合**的 `Round` 数据一次列出来
 * （字段对齐 `models/combat.py::Round`），对应 TUI `/round` 的逐回合视角。
 *
 * 由战斗房 ⚙「副本操作」菜单里的「战斗信息」一行打开（`RoomActionsDialog` 回调 → `RoomScaffold`
 * 的 `pane` 切到这层）。战斗的宏观状态原本是战斗页顶部的一排 chip，现在收进菜单里，战斗页本身
 * 只留"现在该做什么"；**初始化 / 回合开始 / 行动 / 结算哪个 phase 都能开**（只依赖战斗数据在不在）。
 *
 * 参战者按**阵营**分两段，一段一行：名字 + 是否战死。这不只是分组——`DeathComponent` 在数据里
 * 只是有无之分，谁死谁活要对着名单读，而"死了几只"正是复盘第一眼要看的。所以这里**刻意不筛掉
 * 死者**（行动面板那份要筛）。
 *
 * 快照自己取（`useCombatScene`，与房间页同一个 query key，所以命中缓存、不会多发一次请求）：
 * 这一层挂在 `RoomScaffold` 上，而快照的持有者 `CombatRoomPanel` 在它的 `children` 里，
 * 拿不到——所以由浮窗自己问，而不是把参战者从下面往上提。
 *
 * 它自己就是一层浮窗：菜单点它时已经关了菜单再开它（对照 docs/pages.md「同类切换不叠第三层」），
 * 所以这里不需要 `DeckBrowserDialog` 那种关层守卫。
 */
export default function CombatInfoDialog({
  userName,
  gameName,
  room,
  onClose,
}: {
  userName: string;
  gameName: string;
  /** 当前战斗房（`room.combat` 在这里读；参战者快照也要它来定位本间的怪物）。 */
  room: Schemas["CombatRoom"];
  onClose: () => void;
}) {
  const scene = useCombatScene(userName, gameName, room);
  const combat = room.combat;

  // 阵营判据与 `classifyFaction` 一致（玩家 / NPC → 我方，怪物 → 敌方）。认不出的那些也算我方：
  // 分错了只是排错段，被藏起来才会真丢信息，所以两边用「非怪物 / 是怪物」而不是正反两个枚举。
  const camps = [
    {
      label: "我方",
      members: scene.combatants.filter((combatant) => combatant.faction !== "monster"),
    },
    {
      label: "敌方",
      members: scene.combatants.filter((combatant) => combatant.faction === "monster"),
    },
  ];

  return (
    <Modal title="战斗信息" size="lg" onClose={onClose}>
      <dl className="facts">
        <dt>状态</dt>
        <dd>{COMBAT_STATE_LABELS[combat.state] ?? combat.state}</dd>
        <dt>结果</dt>
        <dd>{COMBAT_RESULT_LABELS[combat.result] ?? combat.result}</dd>
        <dt>回合</dt>
        <dd>{combat.rounds.length}</dd>
        {combat.retreated ? (
          <>
            <dt>撤退</dt>
            <dd>已撤退</dd>
          </>
        ) : null}
      </dl>

      <h3>参战者</h3>
      {scene.isError ? (
        <p className="error">无法获取参战者：{describeApiError(scene.error)}</p>
      ) : null}
      {scene.combatants.length === 0 ? (
        // 名单还没回来（或这一间确实没人）：说法与别处的参战者名单一致
        <p className="muted">{scene.isPending ? "加载参战者…" : "场景内暂无参战者。"}</p>
      ) : (
        camps.map((camp) => (
          <CampSection key={camp.label} label={camp.label} members={camp.members} />
        ))
      )}

      <h3>全部回合</h3>
      {combat.rounds.length === 0 ? (
        <p className="muted">（尚无回合记录）</p>
      ) : (
        <ul className="plain">
          {combat.rounds.map((round, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 回合按顺序只追加，永不重排，下标即稳定身份
            <li key={index}>
              <RoundFacts index={index} round={round} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
