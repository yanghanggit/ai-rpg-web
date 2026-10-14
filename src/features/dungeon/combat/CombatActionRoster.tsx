import { displayName } from "../../../components/displayName";
import { type Combatant, countOnHitAffixes, countTransferredCards, roleLabel } from "./readCombat";

/**
 * 行动面板（turn）的参战者一览（横向滚动）：每格一张竖长牌，思路取自《怪物火车》——
 * 中段是**立绘区**（`.combatant-art`，先空着），下面是名字横幅（当前行动 / 已行动并进横幅）
 * 与词条区（手牌 / 被动 / 塞牌）；底排三个：左下总格挡（盾）/ 正下定性（阵营）/ 右下 HP（心）。
 *
 * 名单按 `order`（当前回合 `action_order`）排，本身就是行动顺序：已行动置灰，当前行动由名单上方
 * 一条**固定**的进度条（`.combat-action-track`，走过绿 / 未到灰，粗箭头停在当前那张上）指示，
 * 不给卡片描边。进度条与名单是兄弟节点、同在 `.combat-roster-scroll` 里，所以它**不随卡片选中时的
 * 下移而动**（否则会被截断），只随名单一起横滑。选目标态**不给所有卡上色**（ALL / SPREAD 会让
 * 整排都黄，等于没标）；只有真正「出列」的目标（`.combatant-card--target`）才带特殊色 + 下移。
 *
 * 整卡点击 = 选目标（`picking`）或开角色信息；词条区那颗按钮 = 看该角色手牌，标着
 * `[被动] N` / `[塞牌] M`（我方与怪物都可能被塞牌）。名字显示走 `displayName`，key 用原名。
 */
export default function CombatActionRoster({
  combatants,
  currentActor,
  pending = false,
  order,
  completed = [],
  picking = false,
  targets = [],
  onPick,
  onOpenInfo,
  onOpenHand,
}: {
  combatants: Combatant[];
  currentActor: string | null;
  /** 参战者快照还没取回来：显示加载中，而不是「暂无参战者」。 */
  pending?: boolean;
  /** 行动顺序（原始名）；给了就按它排列名单。 */
  order?: string[];
  /** 已行动的角色（原始名）→ 置灰 +「已行动」。 */
  completed?: string[];
  /** 正在为一张手牌选目标：存活角色整卡可点（优先于 `onOpenInfo`）。 */
  picking?: boolean;
  /** 玩家已选中的目标集（原始名）：命中集里的卡都**下移**（`all` / `spread` 是整阵营）。 */
  targets?: string[];
  /** 点某名角色：选中 / 取消它作为手牌目标（**不直接出牌**）。 */
  onPick?: (name: string) => void;
  /** 点整张卡（非选目标态）→ 开角色信息。 */
  onOpenInfo?: (name: string) => void;
  /** 点卡底按钮 → 看该角色的手牌。 */
  onOpenHand?: (name: string) => void;
}) {
  // 行动队列 = 活着的人（`Round.action_order` 是回合开始时的快照，不含战死者）
  const alive = combatants.filter((combatant) => !combatant.dead);

  if (alive.length === 0) {
    return <p className="muted">{pending ? "加载参战者…" : "场景内暂无参战者。"}</p>;
  }

  // 给了行动顺序就按它排；不在顺序里的（理论上没有）排到最后，保持原相对次序。
  const ordered =
    order === undefined || order.length === 0
      ? alive
      : [...alive].sort((a, b) => {
          const rank = (name: string) => {
            const index = order.indexOf(name);
            return index === -1 ? order.length : index;
          };
          return rank(a.name) - rank(b.name);
        });
  const completedSet = new Set(completed);

  return (
    <div className="combat-roster-scroll">
      {/* 卡外进度条：与名单同一套卡宽 / 间距，段段相接成一条从左到右的粗线，
          颜色停在当前行动者那段（`--done` 是已走过、`--current` 收尾带箭头）。 */}
      <div className="combat-action-track" aria-hidden="true">
        {ordered.map((combatant) => {
          const isCurrent = combatant.name === currentActor;
          const isCompleted = !isCurrent && completedSet.has(combatant.name);
          const trackClasses = ["combat-track"];
          if (isCurrent) {
            trackClasses.push("combat-track--current");
          } else if (isCompleted) {
            trackClasses.push("combat-track--done");
          }
          return <span key={combatant.name} className={trackClasses.join(" ")} />;
        })}
      </div>

      <ul className="combat-action-roster" aria-label="参战者">
        {ordered.map((combatant) => {
          const isCurrent = combatant.name === currentActor;
          const isCompleted = !isCurrent && completedSet.has(combatant.name);
          const isPickable = picking && onPick !== undefined;
          const isTarget = targets.includes(combatant.name);
          const classes = ["combatant-card"];
          if (combatant.player) {
            classes.push("combatant-card--you");
          }
          if (isCurrent) {
            classes.push("combatant-card--current");
          }
          if (isCompleted) {
            classes.push("combatant-card--done");
          }
          if (isTarget) {
            classes.push("combatant-card--target");
          }
          const onHitCount = countOnHitAffixes(combatant);
          const transferredCount = countTransferredCards(combatant, combatants);
          return (
            <li
              key={combatant.name}
              className={classes.join(" ")}
              aria-current={isCurrent ? "true" : undefined}
            >
              {/* 内框：立绘 / 名字 / 词条都收在这一块里；底排的盾 / 心凸出于它 */}
              <div className="combatant-inner">
                {/* 立绘区：先空着（占上半） */}
                <span className="combatant-art" aria-hidden="true" />

                {/* 名字横幅：当前行动 / 已行动 并进横幅（不再另占一个角） */}
                <span className="combatant-name">
                  {displayName(combatant.name)}
                  {isCurrent ? (
                    <span className="combatant-name-state combatant-name-state--current">
                      当前行动
                    </span>
                  ) : isCompleted ? (
                    <span className="combatant-name-state">已行动</span>
                  ) : null}
                </span>

                {/* 词条区：手牌 / 被动 / 塞牌；点它看该角色手牌（与旧卡底按钮同一入口） */}
                <button
                  type="button"
                  className="combatant-keywords"
                  aria-label={`查看手牌：${displayName(combatant.name)}`}
                  onClick={() => onOpenHand?.(combatant.name)}
                >
                  <span className="affix-chip affix-chip--hand">
                    [手牌] {combatant.hand.length}
                  </span>
                  <span className="affix-chip affix-chip--hit">[被动] {onHitCount}</span>
                  <span className="affix-chip affix-chip--transfer">[塞牌] {transferredCount}</span>
                </button>
              </div>

              {/* 左下：总格挡（盾形底） */}
              <span className="combatant-chip combatant-chip--block" title="总格挡">
                <svg className="combatant-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M50 5 L91 21 V51 C91 76 72 91 50 97 C28 91 9 76 9 51 V21 Z" />
                </svg>
                <span className="combatant-chip-value">{combatant.block}</span>
              </span>

              {/* 右下：HP（心形底，只显当前值） */}
              <span className="combatant-chip combatant-chip--hp" title="HP">
                <svg className="combatant-chip-bg" viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M50 90 C20 68 7 51 7 35 C7 20 18 9 32 9 C41 9 47 14 50 20 C53 14 59 9 68 9 C82 9 93 20 93 35 C93 51 80 68 50 90 Z" />
                </svg>
                <span className="combatant-chip-value">
                  {combatant.stats === null ? "—" : combatant.stats.hp}
                </span>
              </span>

              {/* 正下：定性（阵营 / 身份） */}
              <span className="combatant-role">{roleLabel(combatant)}</span>
              {/* 整卡可点：选目标态 → 指定目标；否则 → 看角色信息 */}
              {isPickable ? (
                <button
                  type="button"
                  className="actor-card-open"
                  aria-label={`选择目标：${displayName(combatant.name)}`}
                  onClick={() => onPick(combatant.name)}
                />
              ) : onOpenInfo === undefined ? null : (
                <button
                  type="button"
                  className="actor-card-open"
                  aria-label={`查看角色：${displayName(combatant.name)}`}
                  onClick={() => onOpenInfo(combatant.name)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
