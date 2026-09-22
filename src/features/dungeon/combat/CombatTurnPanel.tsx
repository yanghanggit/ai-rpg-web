import { useState } from "react";
import type { Schemas } from "../../../api/types";
import CardDetailDialog from "../../cards/CardDetailDialog";
import CardItem from "../../cards/CardItem";
import CardListDialog from "../../cards/CardListDialog";
import type { Card } from "../../cards/types";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import CombatActionRoster from "./CombatActionRoster";
import type { Combatant } from "./readCombat";
import type { CombatActions } from "./useCombatActions";

/**
 * 单个角色的回合行动（`ONGOING` 且有 `current_actor`，对应 TUI `CombatTurnActorScreen`）。
 *
 * 版面分三块（对应设计草稿）：
 * 1. **参战者横滑名单**（`CombatActionRoster`）：按 `action_order` 排，已行动 / 当前 / 待行动一眼可读——
 *    名单本身就是行动顺序，不另画顺序条；
 * 2. **行动区**三栏：左列当前行动者的资源（HP 攻防 / 能量 / 总格挡 / 抽牌堆，2×2）、中间手牌横滑、
 *    右列收尾动作 + 牌堆（2×2：过牌 / 消耗牌堆 / 弃牌堆，空一格）；
 * 3. **出牌交互**：点一张手牌选中 → 点名单里的角色指定目标（整卡按钮）→ 出牌；
 *    自身牌没有目标，选中后在手牌条点「出牌（自身）」。
 *
 * 名单卡还挂着两个**只读**入口（不影响出牌）：点整张卡开**角色信息**（`ActorInfoDialog`）；
 * 点卡底那颗常驻按钮（只给 [被动] / [塞牌] 数量）开**手牌**（`CardListDialog`，可再点卡进三级卡牌详情）——
 * 自己与对方都能看，口径统一。
 *
 * 我方与怪物**共用同一套版面**：怪物的手牌是 AI 控制的只读态（不可点选），右下那颗动作由
 * 「过牌」换成「推进怪物回合」。
 *
 * 服务端 `resolve_targets` 要求非 `self_target` 牌**恰好一个目标**作为锚点，所以目标必须显式选。
 * `play / use / gear` 不推进行动权，`pass`/怪物推进才结束回合；动作成功后失效刷新、
 * `CombatRoomPanel` 重新派生 phase 自然会切换 / 重渲染。
 */
export default function CombatTurnPanel({
  userName,
  gameName,
  combat,
  combatants,
  currentActor,
  combatPending,
  actions,
}: {
  userName: string;
  gameName: string;
  combat: Schemas["Combat"];
  combatants: Combatant[];
  currentActor: string | null;
  combatPending: boolean;
  actions: CombatActions;
}) {
  // 选中的手牌（uuid）；出牌 / 换行动角色后清空
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  // 名单卡上的两个只读浮窗（角色信息 / 手牌）：同时只开一个
  const [infoActor, setInfoActor] = useState<string | null>(null);
  const [handActor, setHandActor] = useState<string | null>(null);
  // 手牌上点词缀 → 叠一层卡牌详情
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  // 换行动角色就清掉上一张选中的牌（React 的「props 变了就重置 state」写法，不用 effect）：
  // 同一回合里 party → monster 组件不卸载，必须显式重置，否则残留的选中会指到新角色的手牌上。
  const [lastActor, setLastActor] = useState(currentActor);
  if (lastActor !== currentActor) {
    setLastActor(currentActor);
    setSelectedUuid(null);
  }

  const latest = combat.rounds.at(-1) ?? null;
  const current = combatants.find((combatant) => combatant.name === currentActor) ?? null;

  const actionError =
    actions.play.error ??
    actions.advance.error ??
    actions.pass.error ??
    actions.use.error ??
    actions.gear.error;

  if (current === null) {
    return <p className="error">找不到当前行动角色：{currentActor ?? "（无）"}</p>;
  }

  const isMonster = current.faction === "monster";
  const actor = current;
  const selected = current.hand.find((card) => card.uuid === selectedUuid) ?? null;
  // 选中的是非自身牌且是自己人时，名单进入「选目标」态；怪物手牌不可选，永远不进入
  const picking = !isMonster && selected !== null && !selected.self_target;
  // 正开着「手牌」浮窗的那个角色（原始名匹配）
  const handOwner = combatants.find((combatant) => combatant.name === handActor) ?? null;

  /** 出一张牌：自身牌自动指向自己，其余用名单里点中的目标。 */
  function play(card: Card, targetName?: string) {
    const targets = card.self_target ? [actor.name] : [targetName ?? ""];
    if (!card.self_target && targets[0] === "") {
      return;
    }
    setSelectedUuid(null);
    actions.play.start(actor.name, card.name, targets);
  }

  return (
    <>
      <section className="combat-turn" aria-label="回合行动">
        <CombatActionRoster
          combatants={combatants}
          currentActor={currentActor}
          pending={combatPending}
          order={latest?.action_order ?? []}
          completed={latest?.completed_actors ?? []}
          picking={picking}
          onPick={(name) => {
            if (selected !== null) {
              play(selected, name);
            }
          }}
          onOpenInfo={(name) => {
            setHandActor(null);
            setInfoActor(name);
          }}
          onOpenHand={(name) => {
            setInfoActor(null);
            setHandActor(name);
          }}
        />

        <div className="combat-action-area">
          {/* 左列：当前行动者的资源 */}
          <ul className="combat-resources" aria-label="行动者资源">
            <li className="res res--hp">
              <span className="res-value">
                HP {current.stats === null ? "—" : `${current.stats.hp}/${current.stats.max_hp}`}
              </span>
              <span className="res-sub">
                {current.stats === null
                  ? ""
                  : `攻 ${current.stats.attack} · 防 ${current.stats.defense}`}
              </span>
            </li>
            <li className="res res--energy">
              <span className="res-gem">{current.energy}</span>
              <span className="res-label">能量</span>
            </li>
            <li className="res res--block">
              <span className="res-gem">{current.block}</span>
              <span className="res-label">总格挡</span>
            </li>
            <li className="res res--pile">
              <span className="res-cylinder">{current.piles.draw}</span>
              <span className="res-label">抽牌堆</span>
            </li>
          </ul>

          {/* 中间：出牌状态条（占中列顶部那个空出来的场景卡位）+ 手牌横滑 */}
          <div className="combat-hand">
            <div className="combat-hand-bar">
              {isMonster ? (
                <p className="muted">怪物手牌由 AI 自动打出。</p>
              ) : selected === null ? (
                <p className="muted">点一张手牌开始出牌。</p>
              ) : selected.self_target ? (
                <>
                  <span>已选：{selected.name}</span>
                  <button type="button" disabled={actions.isBusy} onClick={() => play(selected)}>
                    出牌（自身）
                  </button>
                  <button type="button" onClick={() => setSelectedUuid(null)}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span>已选：{selected.name} · 点上方角色选择目标</span>
                  <button type="button" onClick={() => setSelectedUuid(null)}>
                    取消
                  </button>
                </>
              )}
            </div>

            {current.hand.length === 0 ? (
              <p className="muted">（手牌为空）</p>
            ) : (
              <ul className="combat-hand-list" aria-label="手牌">
                {current.hand.map((card) => (
                  <CardItem
                    key={card.uuid}
                    card={card}
                    affixes="names"
                    selected={card.uuid === selectedUuid}
                    owner={current.name}
                    onAffixClick={setDetailCard}
                    selectAriaLabel={
                      isMonster
                        ? `查看手牌：${card.name}`
                        : card.uuid === selectedUuid
                          ? `取消选中：${card.name}`
                          : `选中手牌：${card.name}`
                    }
                    // 怪物手牌只读：不给 onSelect 就整卡不可点
                    {...(isMonster
                      ? {}
                      : {
                          onSelect: () =>
                            setSelectedUuid((prev) => (prev === card.uuid ? null : card.uuid)),
                        })}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* 右列：本回合的收尾动作 + 两个牌堆（三个块在卡高内均匀分布） */}
          <ul className="combat-piles" aria-label="牌堆">
            <li className="combat-piles-action">
              <button
                type="button"
                className="combat-pass"
                aria-label={isMonster ? "推进怪物回合" : "过牌（结束回合）"}
                title={isMonster ? "推进怪物回合" : "过牌（结束回合）"}
                disabled={actions.isBusy}
                onClick={() =>
                  isMonster ? actions.advance.start(current.name) : actions.pass.start(current.name)
                }
              >
                <span className="combat-pass-icon" aria-hidden="true">
                  »
                </span>
                {isMonster
                  ? actions.advance.isBusy
                    ? "推进中…"
                    : "推进"
                  : actions.pass.isBusy
                    ? "过牌中…"
                    : "过牌"}
              </button>
            </li>
            <li className="res res--pile">
              <span className="res-cylinder">{current.piles.exhaust}</span>
              <span className="res-label">消耗牌堆</span>
            </li>
            <li className="res res--pile">
              <span className="res-cylinder">{current.piles.discard}</span>
              <span className="res-label">弃牌堆</span>
            </li>
          </ul>
        </div>

        {actionError ? <p className="error">回合动作失败：{actionError}</p> : null}
      </section>

      {/* 名单卡上的两个只读浮窗：角色信息 / 该角色手牌（同时只开一个，见上面的 onClick） */}
      {infoActor === null ? null : (
        <ActorInfoDialog
          userName={userName}
          gameName={gameName}
          actorName={infoActor}
          costumeEnabled={false}
          onClose={() => setInfoActor(null)}
        />
      )}

      {handActor === null ? null : (
        <CardListDialog
          title="手牌"
          actorName={handActor}
          cards={handOwner?.hand ?? []}
          emptyText="（手牌为空）"
          owner={handActor}
          onClose={() => setHandActor(null)}
        />
      )}

      {/* 手牌上点词缀标记叠出的卡牌详情（词缀全文） */}
      {detailCard === null ? null : (
        <CardDetailDialog card={detailCard} onClose={() => setDetailCard(null)} />
      )}
    </>
  );
}
