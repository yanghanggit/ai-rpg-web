import { useState } from "react";
import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import { readStageInfo } from "../../stage/readStageInfo";
import StageInfoDialog from "../../stage/StageInfoDialog";
import { useStageEntity } from "../../stage/useStageEntity";
import { hasUnclaimedRewards } from "./hasUnclaimedRewards";
import SpoilsDialog from "./SpoilsDialog";
import StageCard, { type StageCardState } from "./StageCard";
import type { OpeningActions } from "./useOpeningActions";
import type { OpeningParty, OpeningPartyMember } from "./useOpeningParty";
/**
 * 开场房间的房间主体（`room.type === "opening"`）。
 *
 * 三块内容，对应玩家的实际流程「初始化 → 生成奖励 → 领卡 → 结束本间」：
 * - **场景卡**（横置、固定大小，`StageCard`）：环境叙述（当前场景的 `EnvironmentComponent`）。
 *   初始化中显示「进行中…」、失败显示原因且**点整张卡重试**、好了就显示叙述且**点整张卡看全文**
 *   （弹 `StageInfoDialog`）——与标题行那颗兜底图标同一套状态，只是卡片更宽、能写清楚；
 * - 场景卡右边那张「回到地图」卡：本间的下一步（初始化完成后才出现）；
 * - **队伍**（**没有可见标题**：卡上写着名字，“队伍”是废话）：竖着的角色卡，一张挨一张横排
 *   （顺序即后端给的队伍顺序，玩家在前）——卡面是「名字 + 属性（HP/ATK/DEF）+ DECK 张数」，
 *   点卡上的名字开角色信息浮窗；卡底那颗按钮是
 *   本成员的奖励入口，**三态**：生成奖励 → 获取奖励 → 查看奖励（见下）。卡片的形状与牌组 /
 *   奖励里的**卡面同一套**（窄而高的矩形），横排就是「队伍站位」的 UX 雏形。
 *   **卡上不再有「查看牌组」**：牌组已由标题行的「牌组」入口统一提供（`RoomScaffold`，同一份
 *   `useOpeningParty`），不在房间里再开一个口子——两个入口会各自演化出两份卡面。
 *
 * **卡片是这一屏的基调**：横置的场景卡（横 = 场景 / 进度）、旁边一张横置的「回到地图」卡，
 * 下面一排竖置的角色卡（竖 = 人）。
 *
 * **本层没有工具栏**：本间的主行动（初始化中 / 重试初始化 / 结束本间）**主 body 与标题行各有一份**
 * ——body 上是场景卡与「回到地图」卡（更好点、更好观察），标题行那颗（`RoomScaffold` 的
 * `roomAction`，由页面算）是**兜底**：同一套动作在两个地方都有入口，不靠字形让人猜。
 *
 * **初始化自动跑一次**：进入开场房间后，若 `room.initialized === false` 就自动发一次初始化任务
 * （在页面里做，按房间标识做一次性 guard）；失败**不自动重试**，改由标题行那颗 ↻ 手动重试
 * （服务端要求先初始化才能推进 / 退出）。
 *
 * **本间是一扇单向门**：标题行那颗 → 一旦按下就回地图，而**已结束的房间进不去**（地图上不再提供
 * "进入房间"）。奖励候选本来就挂在队伍成员身上、只有当前还是开场房时才能领
 * （`activate_pick_spoils_card` 要求 `is_current_room_dungeon_opening`），所以没领的卡就永久
 * 留在那里——这是设计上要的惩罚，所以只**提醒不阻止**（提醒就在卡上那颗按钮）。
 *
 * 这里**只放开场房间独有的东西**——标题、副本信息、叙事入口、离开副本属于外层框架
 * （`OpeningRoomPage` 的 `RoomScaffold`），不在这一层重复。「进入下一间」属于地图
 * （`map/DungeonMapPanel`）：推进是整局副本的前进动作，不是某个房间的动作。
 *
 * 注意这一层的「叙事」二字指场景环境叙述（现在写在场景卡里），与按钮打开的
 * 「全部叙事」（会话事件流，外层 `NarrativeButton`）不是同一份数据。
 *
 * **奖励渐进式披露**：不摊在页面上，角色卡上只留那一颗三态按钮，点开才展开候选卡。「挑选」
 * 不做二次确认，防误触靠卡片上的显式按钮（与队伍名单的「加入 / 移出」同一套心智）。
 *
 * **「生成奖励」是整队一次的动作，所以它长在每张卡上却只算一件事**：后端 `activate_generate_spoils`
 * 一次给全队挂 `SpoilsComponent`，所以点**任何**一张卡上的「生成奖励」都是同一次调用，
 * 生成后每张卡一起从「生成奖励」变成「获取奖励」（按钮的 `title` 也这么写，免得看成单人生成）。
 * 领取 / 查看才是按成员各自的（`pick_spoils/pick_card` 带 `actor_name`），所以三态里只有第一态是共用的。
 * 未初始化时那颗按钮**在但不可点**（服务端硬前置）：把"下一步是什么"提前告诉玩家，而不是凭空少一个按钮。
 */
export default function OpeningRoomPanel({
  userName,
  gameName,
  room,
  actions,
  party,
  onFinishRoom,
}: {
  userName: string;
  gameName: string;
  room: Schemas["OpeningRoom"];
  /** 本间的动作（页面持有唯一实例后传下来）：角色卡上的奖励按钮用它。 */
  actions: OpeningActions;
  /** 本次副本固化的队伍与奖励（页面取一次传下来）：角色卡的内容。 */
  party: OpeningParty;
  /** 本间的结束动作（回地图）：与标题行那颗 → 同一件事，这张「回到地图」卡更显眼。 */
  onFinishRoom: () => void;
}) {
  const stage = useStageEntity(userName, gameName, room.stage.name);

  // 正在看场景全文（非空即打开场景信息浮窗）
  const [isStageOpen, setIsStageOpen] = useState(false);
  // 正在看奖励的成员（原始名）；非空即打开奖励浮窗
  const [spoilsMember, setSpoilsMember] = useState<string | null>(null);
  // 正在看角色信息的成员（原始名）；非空即打开角色信息浮窗
  const [infoActor, setInfoActor] = useState<string | null>(null);

  const narrative =
    stage.data?.entities[0] === undefined ? null : readStageInfo(stage.data.entities[0]).narrative;

  const spoilsOf = party.party.find((member) => member.name === spoilsMember)?.spoils ?? null;

  // 场景卡的三态：未初始化 = 还在跑 / 跑失败；初始化完成 = 叙述可看（全文点开）
  const stageState: StageCardState = !room.initialized
    ? actions.init.error === null
      ? "running"
      : "failed"
    : "ready";
  // 卡面正文：三种状态共用同一条位置（卡片骨架不变形）；叙述可能已生成但还没取回来
  const stageBody =
    stageState === "failed"
      ? `初始化失败：${actions.init.error}`
      : stageState === "running"
        ? "进行中…"
        : narrative !== null
          ? narrative
          : stage.isError
            ? `无法获取环境叙述：${describeApiError(stage.error)}`
            : stage.isPending
              ? "加载中…"
              : "（暂无环境描写）";

  /** 某张角色卡上那颗按钮现在该写什么：生成奖励 → 获取奖励 → 查看奖励。 */
  function spoilsLabel(member: OpeningPartyMember): string {
    if (member.spoils === null) {
      return actions.spoils.isBusy ? "生成中…" : "生成奖励";
    }
    return member.spoils.claimedCards.length > 0 ? "查看奖励" : "获取奖励";
  }

  return (
    <>
      {/* 场景行：**横置**的场景卡（固定大小，叙述超出三行就省略）+ 右侧「回到地图」卡。
          这两张卡（横 = 场景 / 进度）与下面竖置的角色卡（竖 = 人）构成这一屏的卡片基调。
          卡上的状态与标题行那颗兜底图标同源：初始化中 → 失败可点重试 → 就绪可点看全文。 */}
      <section className="stage-row" aria-label="场景描述">
        <StageCard
          state={stageState}
          body={stageBody}
          onActivate={
            stageState === "failed" ? () => actions.init.start() : () => setIsStageOpen(true)
          }
        />

        {/* 初始化完成后才出现：本间的下一步（回地图）。与标题行那颗 → 是同一件事，
            这里更显眼也更好点，那颗是兜底。 */}
        {room.initialized ? (
          <button
            type="button"
            className="stage-next"
            aria-label="结束开局准备（回到地图）"
            title="结束开局准备（回到地图）—— 本间结束后进不来。"
            onClick={onFinishRoom}
          >
            <span className="stage-next-arrow" aria-hidden="true">
              →
            </span>
            <span className="stage-next-caption">回到地图</span>
          </button>
        ) : null}

        {/* 初始化失败已写在场景卡里（那颗 ↻ 也变红），这里只说奖励那一支；领卡失败在奖励浮窗内显示 */}
        {actions.spoils.error ? (
          <p className="error">生成奖励失败：{actions.spoils.error}</p>
        ) : null}
      </section>

      {/* 这一块**不超可见标题**（卡上写着名字，「队伍」是废话）——靠与上面环境叙述的距离分组，
          留个无障碍名让读屏器与测试还能指认它。 */}
      <section className="party-section" aria-label="队伍">
        {party.isPending ? <p className="muted">加载中…</p> : null}
        {party.isError ? <p className="error">无法获取队伍状态：{String(party.error)}</p> : null}

        {/* 竖着的角色卡一张挨一张横排：顺序沿用后端给的队伍顺序（玩家在前），就是「站位」的 UX 雏形 */}
        <div className="cards cards--party">
          {party.party.map((member) => (
            <article key={member.name} className="card actor-card">
              <div className="card-head">
                {/* 点名字开角色信息（与家园页的角色 chip 同一交互） */}
                <button
                  type="button"
                  className="chip chip-button mono"
                  onClick={() => setInfoActor(member.name)}
                >
                  {displayName(member.name)}
                </button>
                {member.player ? <span className="badge">玩家</span> : null}
              </div>

              {/* 卡面数据：属性（会变的血量最要紧）+ 牌组张数，**一组**、一行一项
                  （横排会被卡宽挤断；拉开成两段中间会空一行，难看） */}
              <p className="muted actor-card-stats">
                {member.stats === null ? null : (
                  <>
                    <span>
                      HP {member.stats.hp}/{member.stats.max_hp}
                    </span>
                    <span>ATK {member.stats.attack}</span>
                    <span>DEF {member.stats.defense}</span>
                  </>
                )}
                <span>DECK {member.deck.length}</span>
              </p>

              {/* 卡上唯一一颗按钮 = 本成员的奖励入口，三态：生成奖励 → 获取奖励 → 查看奖励。
                  生成是**整队一次**的动作（点哪张卡上的都一样），所以给 button 加 title 说明。
                  「还有候选卡未领」不另外占一行页面提示：它就是第二态本身，
                  所以把提醒做到按钮上（提醒色 + 「!」），后果写进 title。 */}
              <div className="card-actions">
                {member.spoils === null ? (
                  <button
                    type="button"
                    // 生成需要开场已初始化（服务端硬前置）：未初始化时按钮在，但不可点
                    disabled={!room.initialized || actions.isBusy}
                    title="一次为整队生成奖励（点任何一张卡上的它都一样）"
                    onClick={() => actions.spoils.start()}
                  >
                    {spoilsLabel(member)}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={hasUnclaimedRewards(member) ? "button--pending" : undefined}
                    title={
                      hasUnclaimedRewards(member)
                        ? "还有候选卡未领：结束本间后就无法再领取了。"
                        : "本成员的奖励（已领取的也可以回看）"
                    }
                    onClick={() => setSpoilsMember(member.name)}
                  >
                    {spoilsLabel(member)}
                    {hasUnclaimedRewards(member) ? (
                      <span className="button-mark" aria-hidden="true">
                        !
                      </span>
                    ) : null}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {isStageOpen ? (
        <StageInfoDialog
          userName={userName}
          gameName={gameName}
          stageName={room.stage.name}
          // 开场房里「场景内角色」就是这一局的队伍（进副本/推进时被搬进这间场景），不必另取一份
          actorNames={party.party.map((member) => member.name)}
          // 同类切换不叠层：点场景里的角色 → 关场景浮窗、换角色浮窗（与家园页同一套）
          onSelectActor={(actorName) => {
            setIsStageOpen(false);
            setInfoActor(actorName);
          }}
          onClose={() => setIsStageOpen(false)}
        />
      ) : null}

      {spoilsMember === null || spoilsOf === null ? null : (
        <SpoilsDialog
          memberName={spoilsMember}
          spoils={spoilsOf}
          busy={actions.isBusy}
          error={actions.pickCard.error}
          onPick={(cardName) => actions.pickCard.start(spoilsMember, cardName)}
          onClose={() => setSpoilsMember(null)}
        />
      )}

      {infoActor === null ? null : (
        <ActorInfoDialog
          userName={userName}
          gameName={gameName}
          actorName={infoActor}
          // 副本进行中家园接口会被拒，角色信息里不提供穿/脱时装
          costumeEnabled={false}
          onClose={() => setInfoActor(null)}
        />
      )}
    </>
  );
}
