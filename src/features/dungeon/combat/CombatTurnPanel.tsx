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

/** 可点的牌堆按钮：自带完整描边，与同一列只读的 HP / 能量 / 格挡区分。 */
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
        className={`res res--pile res--pile-${kind}`}
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
 * 「已选」下面那一行：目标的说法。自身牌写`自己`（名单不用再点），还没选就写`未选择`
 * ——那句「点上方角色选择目标」不再出现（名单进入选目标态时会自己亮，"在哪点"不需要用字说）。
 * `spread` 补一句「随机命中」：它选中的集合与 `all` 相同，差别只在落点。
 */
function targetHint(card: Card, targets: string[]): string {
  if (card.target_type === "self") {
    return "目标：自己";
  }
  if (targets.length === 0) {
    return "目标：未选择";
  }
  const list = targets.map(displayName).join("、");
  return card.target_type === "spread" ? `目标：${list}（随机命中）` : `目标：${list}`;
}

/**
 * 「出牌」按钮的状态：`label` 是按钮上那句话，`off` 表示按不下去（灰）。
 * 灰掉时**直接把原因写在字上**，所以这颗按钮位置、形状都不跳，也不用另给一句提示。
 */
function readPlayState(
  card: Card | null,
  energy: number,
  targets: string[],
): { label: string; off: boolean } {
  if (card === null) {
    return { label: "出牌", off: true };
  }
  if (!card.playable) {
    return { label: "不可出牌", off: true };
  }
  if (card.cost > energy) {
    return { label: "能量不足", off: true };
  }
  if (targets.length === 0) {
    return { label: "选择目标", off: true };
  }
  return { label: "出牌", off: false };
}

/**
 * 三块：参战者横滑名单（`CombatActionRoster`，顺序即 `action_order`）、行动区三栏（左 = 当前行动者
 * 资源 / 中 = 手牌横滑 / 右 = 过牌 + 牌堆）、出牌交互。
 *
 * **出牌 = 两次选择 + 一次确认**：点手牌选中、点名单角色选目标；自身牌选中后自动指向自己。
 * 中间那条**常驻三块、位置不跳**：卡的信息 + 查看详情合成**一颗按钮**（`已选` / `目标` 两行）、
 * `出牌`、`取消`。「出牌」灰掉时把原因写在字上（`不可出牌` / `能量不足` / `选择目标`）。
 * 名单卡另有两个只读入口（整卡开角色信息、卡底文本开手牌），三个牌堆
 * 也是按钮（各自打开 `CardListDialog`）。我方与怪物共用同一版面，怪物手牌只读。
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
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [infoActor, setInfoActor] = useState<string | null>(null);
  const [handActor, setHandActor] = useState<string | null>(null);
  const [viewCard, setViewCard] = useState<Card | null>(null);
  const [pile, setPile] = useState<CombatPileKind | null>(null);
  // 换行动角色时清空两次选择：同一回合内组件不卸载，必须显式重置
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
  // 选中非自身牌时，名单进入「选目标」态；怪物手牌不可选
  const picking = !isMonster && selected !== null && selected.target_type !== "self";
  const targets =
    selected === null ? [] : readTargetNames(selected, targetName, actor.name, combatants);
  // 不可出牌（`playable === false`）/ 本回合能量不够 / 还差一个目标：都只灰掉「出牌」
  const unplayable = selected !== null && !selected.playable;
  const playState = readPlayState(selected, actor.energy, targets);
  const handOwner = combatants.find((combatant) => combatant.name === handActor) ?? null;

  /** 出一张牌：自身牌自动指向自己，其余用名单里点中的目标。 */
  function play(card: Card, target: string | null) {
    const targets = card.target_type === "self" ? [actor.name] : [target ?? ""];
    if (card.target_type !== "self" && targets[0] === "") {
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
            // 再点同一张就缩回去
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
          {/* 左列：三个牌堆（三角布局——抽牌 / 消耗牌堆在上，弃牌堆居中在下），每个一色 */}
          <ul className="combat-piles" aria-label="牌堆">
            <PileButton kind="draw" cards={current.piles.draw} onOpen={() => setPile("draw")} />
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

          {/* 中间：出牌状态条 + 手牌横滑 */}
          <div className="combat-hand">
            <div className="combat-hand-bar">
              {isMonster ? (
                <p className="muted combat-hand-note">怪物手牌由 AI 自动打出。</p>
              ) : selected === null ? (
                <p className="muted combat-hand-note">点一张手牌开始出牌。</p>
              ) : (
                <>
                  {/* 卡的信息 + 「查看详情」合成**一颗按钮**：这块本来就是那张牌的身份证，
                      点它开卡牌详情（与词条 chip、名单卡一样「点开看全文」）。两行：已选 / 目标。 */}
                  <button
                    type="button"
                    className="combat-hand-info"
                    aria-label={`查看卡牌详情：${selected.name}`}
                    title="查看卡牌详情"
                    onClick={() => setViewCard(selected)}
                  >
                    <span className="combat-hand-info-glyph" aria-hidden="true">
                      ☰
                    </span>
                    <span className="combat-hand-info-text">
                      <span>已选：{selected.name}</span>
                      <span>{targetHint(selected, targets)}</span>
                    </span>
                  </button>
                  {/* 三块常驻，只是状态不同：灰掉的原因写在「出牌」的字上 */}
                  <button
                    type="button"
                    className={`combat-hand-btn combat-hand-btn--play${
                      playState.off ? " combat-hand-btn--off" : ""
                    }`}
                    disabled={actions.isBusy || playState.off}
                    title={unplayable ? "这张牌写着不可出牌（卡面那枚灰标记）" : undefined}
                    // 只发锚点：`all` / `spread` 的阵营由服务端按锚点展开
                    onClick={() => play(selected, targetName)}
                  >
                    <span className="combat-hand-btn-glyph" aria-hidden="true">
                      {playState.off ? "⊘" : "▶"}
                    </span>
                    <span className="combat-hand-btn-caption">{playState.label}</span>
                  </button>
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
                          onSelect: () => {
                            const wasSelected = selectedUuid === card.uuid;
                            setSelectedUuid(wasSelected ? null : card.uuid);
                            setTargetName(
                              wasSelected
                                ? null
                                : card.target_type === "self"
                                  ? current.name
                                  : null,
                            );
                          },
                        })}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* 右列：能量 + 过牌（正方形对角——能量在左上、过牌在右下），两颗都用大方块。
              hp / 总格挡已经在上方参战者卡上，这里不重复。 */}
          <ul className="combat-resources" aria-label="行动者资源">
            <li className="res res--energy">
              <span className="res-gem">{current.energy}</span>
              <span className="res-label">能量</span>
            </li>
            <li className="combat-pass-slot">
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
                <span className="combat-pass-orb" aria-hidden="true">
                  »
                </span>
                <span className="res-label">
                  {(isMonster ? actions.advance.isBusy : actions.pass.isBusy) ? "PASS…" : "PASS"}
                </span>
              </button>
            </li>
          </ul>
        </div>

        {actionError ? <p className="error">回合动作失败：{actionError}</p> : null}
      </section>

      {/* 名单卡上的两个只读浮窗：角色信息 / 该角色手牌 */}
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

      {/* 牌堆浮窗：与牌组 / 手牌共用 `CardListDialog` */}
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

      {viewCard === null ? null : (
        <CardDetailDialog card={viewCard} owner={current.name} onClose={() => setViewCard(null)} />
      )}
    </>
  );
}
