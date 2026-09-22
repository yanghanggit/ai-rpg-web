import { useState } from "react";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import CardDetailDialog from "../../cards/CardDetailDialog";
import CardItem from "../../cards/CardItem";
import CardListDialog from "../../cards/CardListDialog";
import type { Card } from "../../cards/types";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import CombatActionRoster from "./CombatActionRoster";
import { type Combatant, type CombatPileKind, readTargetNames } from "./readCombat";
import type { CombatActions } from "./useCombatActions";

/** 三个牌堆的界面说法（键与 `Combatant["piles"]` 同名）。 */
const PILE_LABELS: Record<CombatPileKind, string> = {
  draw: "抽牌堆",
  exhaust: "消耗牌堆",
  discard: "弃牌堆",
};

/**
 * 一个牌堆（圆柱 + 名称）。
 *
 * 与同一列的 HP / 能量 / 格挡不同，这三个牌堆是**可点的**（打开这一撑的卡牌列表），所以它自带
 * 一颗按钮的完整描边（css `.res--pile`）——「可点」与「只读」在同一列里一眼分得开。
 */
function PileButton({
  kind,
  cards,
  onOpen,
}: {
  kind: CombatPileKind;
  cards: Card[];
  onOpen: () => void;
}) {
  const label = PILE_LABELS[kind];
  return (
    <li className="combat-pile">
      <button
        type="button"
        className="res res--pile"
        // 无障碍名带上张数：与圆柱里那个数字一致，不必先点开才知道有几张
        aria-label={`查看${label}（${cards.length} 张）`}
        title={`查看${label}`}
        onClick={onOpen}
      >
        <span className="res-cylinder">{cards.length}</span>
        <span className="res-label">{label}</span>
      </button>
    </li>
  );
}

/**
 * 中间那条提示里「目标」的说法：`all` 直接列全体；`spread` 是同一批人 + 「随机命中」。
 * （`spread` 与 `all` 选中集合完全相同，差别在结算与这句话。）
 */
function targetHint(card: Card, targets: string[]): string {
  const list = targets.map(displayName).join("、");
  return card.target_type === "spread" ? `目标：${list}（在以上目标中随机）` : `目标：${list}`;
}

/**
 * 单个角色的回合行动（`ONGOING` 且有 `current_actor`，对应 TUI `CombatTurnActorScreen`）。
 *
 * 版面分三块（对应设计草稿）：
 * 1. **参战者横滑名单**（`CombatActionRoster`）：按 `action_order` 排，已行动 / 当前 / 待行动一眼可读——
 *    名单本身就是行动顺序，不另画顺序条；
 * 2. **行动区**三栏：左列当前行动者的资源（HP 攻防 / 能量 / 总格挡 / 抽牌堆，2×2）、中间手牌横滑、
 *    右列收尾动作 + 牌堆（2×2：过牌 / 消耗牌堆 / 弃牌堆，空一格）；
 * 3. **出牌交互（两次选择 + 一次确认）**：点一张手牌 → 那张牌**上移**（再点一下缩回去 = 取消选中）；
 *    点名单里的角色 → 那张卡**下移**（再点一下也缩回去）；两次都选好后，中间才长出「出牌」按钮，
 *    点它才真的发 `play_cards`。自身牌（`self_target`）选中后**自动**把本人那张压下，
 *    不需要再点名单，中间直接给「出牌」。出牌条就占中列顶部那个空出来的一格（`--card-short` 高）：
 *    左边一块**提示矩形**（「已选 / 目标」那段话在这里折行），右边两颗与开场房「回到地图」卡
 *    同族的**卡状按钮**（图标在上、词在下）——「出牌」是主行动（绿），「取消」静默。
 *
 * 名单卡还挂着两个**只读**入口（不影响出牌）：点整张卡开**角色信息**（`ActorInfoDialog`）；
 * 点卡底那行**平铺的文本**开**手牌**（`CardListDialog`，可再点卡进三级卡牌详情）——
 * 自己与对方都能看，口径统一。
 *
 * 左右两列里那三个**牌堆也是按钮**（抽牌堆 / 消耗牌堆 / 弃牌堆）：点开看这一摞到底是哪些牌。
 * 它们与手牌 / 牌组共用 `CardListDialog`，只是换了标题与内容（`owner` 用当前行动者，
 * 所以【塞牌】照样能认出来）。
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
  // 选中的目标（原始名）；自身牌选中时会自动填成自己
  const [targetName, setTargetName] = useState<string | null>(null);
  // 名单卡上的两个只读浮窗（角色信息 / 手牌）：同时只开一个
  const [infoActor, setInfoActor] = useState<string | null>(null);
  const [handActor, setHandActor] = useState<string | null>(null);
  // 中间那条的「查看」按下的卡 → 叠一层卡牌详情（手牌里整卡点击是"选中"，看详情另给入口）
  const [viewCard, setViewCard] = useState<Card | null>(null);
  // 正开着的牌堆浮窗（抽牌 / 消耗 / 弃牌）；三个都是当前行动者自己的牌堆
  const [pile, setPile] = useState<CombatPileKind | null>(null);
  // 换行动角色就把两次选择都清掉（React 的「props 变了就重置 state」写法，不用 effect）：
  // 同一回合里 party → monster 组件不卸载，必须显式重置，否则残留的选中会指到新角色的手牌上。
  const [lastActor, setLastActor] = useState(currentActor);
  if (lastActor !== currentActor) {
    setLastActor(currentActor);
    setSelectedUuid(null);
    setTargetName(null);
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
  // 名单里该压下去的那些卡（选中态）：自身牌 = 自己；`all` / `spread` = 锚点所在阵营全体
  const targets =
    selected === null ? [] : readTargetNames(selected, targetName, actor.name, combatants);
  // 正开着「手牌」浮窗的那个角色（原始名匹配）
  const handOwner = combatants.find((combatant) => combatant.name === handActor) ?? null;

  /** 出一张牌：自身牌自动指向自己，其余用名单里点中的目标；出牌后把两次选择都清掉。 */
  function play(card: Card, target: string | null) {
    const targets = card.self_target ? [actor.name] : [target ?? ""];
    if (!card.self_target && targets[0] === "") {
      return;
    }
    setSelectedUuid(null);
    setTargetName(null);
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
          targets={targets}
          onPick={(name) => {
            // 只选目标（不直接出牌）：再点同一张就缩回去
            setTargetName((prev) => (prev === name ? null : name));
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
            <PileButton kind="draw" cards={current.piles.draw} onOpen={() => setPile("draw")} />
          </ul>

          {/* 中间：出牌状态条（占中列顶部那个空出来的场景卡位）+ 手牌横滑 */}
          <div className="combat-hand">
            <div className="combat-hand-bar">
              {isMonster ? (
                <p className="muted combat-hand-note">怪物手牌由 AI 自动打出。</p>
              ) : selected === null ? (
                <p className="muted combat-hand-note">点一张手牌开始出牌。</p>
              ) : (
                <>
                  {/* 提示矩形：文字在这里折行显示（与右边几颗卡状按钮并排成一行） */}
                  <p className="combat-hand-hint">
                    已选：{selected.name}
                    {targets.length === 0
                      ? " · 点上方角色选择目标"
                      : ` · ${targetHint(selected, targets)}`}
                  </p>
                  {/* 手牌里整卡点击是"选中"，所以"看这张牌的详情"另给一颗按钮（非手牌那几处是整卡直开）*/}
                  <button
                    type="button"
                    className="combat-hand-btn combat-hand-btn--view"
                    onClick={() => setViewCard(selected)}
                  >
                    <span className="combat-hand-btn-glyph" aria-hidden="true">
                      ☰
                    </span>
                    <span className="combat-hand-btn-caption">查看</span>
                  </button>
                  {/* 两次选择都齐了才长出「出牌」——之前是点目标就发 API，容易误触。
                      按钮形状与开场房「回到地图」卡同族（图标在上、词在下），只是缩成方块。 */}
                  {targets.length === 0 ? null : (
                    <button
                      type="button"
                      className="combat-hand-btn combat-hand-btn--play"
                      disabled={actions.isBusy}
                      // 只发锚点：`all` / `spread` 的阵营由服务端按锚点展开（见 readTargetNames）
                      onClick={() => play(selected, targetName)}
                    >
                      <span className="combat-hand-btn-glyph" aria-hidden="true">
                        ▶
                      </span>
                      <span className="combat-hand-btn-caption">出牌</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="combat-hand-btn combat-hand-btn--cancel"
                    onClick={() => {
                      setSelectedUuid(null);
                      setTargetName(null);
                    }}
                  >
                    <span className="combat-hand-btn-glyph" aria-hidden="true">
                      ✕
                    </span>
                    <span className="combat-hand-btn-caption">取消</span>
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
                    selected={card.uuid === selectedUuid}
                    owner={current.name}
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
                          // 点整张牌 = 选中/取消；选中时自身牌自动把目标填成自己
                          onSelect: () => {
                            const wasSelected = selectedUuid === card.uuid;
                            setSelectedUuid(wasSelected ? null : card.uuid);
                            setTargetName(
                              wasSelected ? null : card.self_target ? current.name : null,
                            );
                          },
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
            <PileButton
              kind="exhaust"
              cards={current.piles.exhaust}
              onOpen={() => setPile("exhaust")}
            />
            <PileButton
              kind="discard"
              cards={current.piles.discard}
              onOpen={() => setPile("discard")}
            />
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

      {/* 牌堆浮窗：与牌组 / 手牌同一个 `CardListDialog`（同一套卡面 + 三级详情），只换标题与内容 */}
      {pile === null ? null : (
        <CardListDialog
          title={PILE_LABELS[pile]}
          actorName={current.name}
          cards={current.piles[pile]}
          emptyText={`（${PILE_LABELS[pile]}为空）`}
          owner={current.name}
          onClose={() => setPile(null)}
        />
      )}

      {/* 手牌上点词缀标记叠出的卡牌详情（词缀全文） */}
      {viewCard === null ? null : (
        <CardDetailDialog card={viewCard} owner={current.name} onClose={() => setViewCard(null)} />
      )}
    </>
  );
}
