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
 * 一阵营一段只读名单：名字横排自动换行，战死的置灰 + 挂「已战死」。
 * 只讲「谁在场、谁死了」，不铺血量攻防；也不标「当前行动」（下面 `Round` 里已有）。
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
 * 「战斗信息」浮窗：战斗宏观状态 + 双方参战者 + 全部回合的 `Round`。
 *
 * 由战斗房 ⚙「副本操作」的「战斗信息」一行打开，任何 phase 都能开。参战者按阵营分两段，
 * 刻意不筛死者（行动面板那份才筛）。快照自己取（与房间页同一 query key，命中缓存）。
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

  // 阵营判据与 `classifyFaction` 一致：认不出的算我方（分错只是排错段，藏起来才会丢信息）
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
        // 名单还没回来（或这间确实没人）
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
