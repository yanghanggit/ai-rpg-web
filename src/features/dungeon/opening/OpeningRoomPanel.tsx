import { useState } from "react";
import type { Schemas } from "../../../api/types";
import { firstEntity } from "../../entities/ecs";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import { readStageInfo } from "../../stage/readStageInfo";
import StageInfoDialog from "../../stage/StageInfoDialog";
import { stageNarrativeBody } from "../../stage/stageNarrativeBody";
import { useStageEntity } from "../../stage/useStageEntity";
import ActorCard from "../ActorCard";
import StageCard, { type StageCardState } from "../StageCard";
import type { DungeonParty, DungeonPartyMember } from "../useDungeonParty";
import { hasUnclaimedRewards } from "./hasUnclaimedRewards";
import SpoilsDialog from "./SpoilsDialog";
import type { OpeningActions } from "./useOpeningActions";

/**
 * 开场房间的房间主体（`room.type === "opening"`）。
 *
 * 三块：横置的场景卡（初始化三态：进行中 → 失败可点重试 → 就绪可点看全文）、右侧「回到地图」卡
 * （初始化完成后才出现）、下面一排竖置的角色卡（整卡开角色信息，卡底按钮是奖励入口，三态：
 * 生成奖励 → 获取奖励 → 查看奖励）。初始化与「结束本间」都只在这层有入口，标题行不重复。
 */
export default function OpeningRoomPanel({
  userName,
  gameName,
  room,
  actions,
  party,
  finish,
}: {
  userName: string;
  gameName: string;
  room: Schemas["OpeningRoom"];
  /** 本间的动作（页面持有唯一实例后传下来）：角色卡上的奖励按钮用它。 */
  actions: OpeningActions;
  /** 本次副本固化的队伍与奖励（页面取一次传下来）：角色卡的内容。 */
  party: DungeonParty;
  /** 本间的结束动作（回地图 / 离开副本），这张「回到地图」卡是它在本屏的唯一入口。 */
  finish: { caption: string; hint: string; onActivate: () => void };
}) {
  const stage = useStageEntity(userName, gameName, room.stage.name);

  const [isStageOpen, setIsStageOpen] = useState(false);
  const [spoilsMember, setSpoilsMember] = useState<string | null>(null);
  const [infoActor, setInfoActor] = useState<string | null>(null);

  const stageEntity = firstEntity(stage.data?.entities ?? {});
  const narrative = stageEntity === undefined ? null : readStageInfo(stageEntity).narrative;

  const spoilsOf = party.party.find((member) => member.name === spoilsMember)?.spoils ?? null;

  // 未领奖励在结束本间后永久失去，所以「回到地图」与角色卡按钮用同一判据变提醒色
  const unclaimed = party.party.some(hasUnclaimedRewards);

  const stageState: StageCardState = !room.initialized
    ? actions.init.error === null
      ? "running"
      : "failed"
    : "ready";
  const stageBody =
    stageState === "failed"
      ? `初始化失败：${actions.init.error}`
      : stageState === "running"
        ? "进行中…"
        : stageNarrativeBody(narrative, stage);

  /** 角色卡按钮的文案：生成奖励 → 获取奖励 → 查看奖励。 */
  function spoilsLabel(member: DungeonPartyMember): string {
    if (member.spoils === null) {
      return actions.spoils.isBusy ? "生成中…" : "生成奖励";
    }
    return member.spoils.claimedCards.length > 0 ? "查看奖励" : "获取奖励";
  }

  return (
    <>
      <section className="stage-row" aria-label="场景描述">
        <StageCard
          state={stageState}
          name={room.stage.name}
          body={stageBody}
          onActivate={
            stageState === "failed" ? () => actions.init.start() : () => setIsStageOpen(true)
          }
        />

        {/* 初始化完成后才出现：本间结束动作的唯一入口 */}
        {room.initialized ? (
          <button
            type="button"
            className={unclaimed ? "stage-next stage-next--warn" : "stage-next"}
            aria-label={`结束开局准备（${finish.caption}）`}
            title={`结束开局准备（${finish.caption}）—— ${
              unclaimed ? "还有候选卡未领，结束本间后就无法再领取了。" : finish.hint
            }`}
            onClick={finish.onActivate}
          >
            <span className="stage-next-arrow" aria-hidden="true">
              →
            </span>
            <span className="stage-next-caption">{finish.caption}</span>
          </button>
        ) : null}

        {/* 初始化失败已写在场景卡里，这里只说生成奖励那一支；领卡失败在奖励浮窗内显示 */}
        {actions.spoils.error ? (
          <p className="error">生成奖励失败：{actions.spoils.error}</p>
        ) : null}
      </section>

      <section className="party-section" aria-label="队伍">
        {party.isPending ? <p className="muted">加载中…</p> : null}
        {party.isError ? <p className="error">无法获取队伍状态：{String(party.error)}</p> : null}

        <div className="cards cards--party">
          {party.party.map((member) => (
            <ActorCard
              key={member.name}
              name={member.name}
              badge={member.player ? "玩家" : undefined}
              stats={member.stats}
              extra={`卡组 ${member.deck.length}`}
              onOpenInfo={() => setInfoActor(member.name)}
            >
              {/* 卡上唯一一颗按钮 = 本成员奖励入口；「生成奖励」是整队一次的动作 */}
              {member.spoils === null ? (
                <button
                  type="button"
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
            </ActorCard>
          ))}
        </div>
      </section>

      {isStageOpen ? (
        <StageInfoDialog
          userName={userName}
          gameName={gameName}
          stageName={room.stage.name}
          // 开场房里「场景内角色」就是这一局的队伍
          actorNames={party.party.map((member) => member.name)}
          // 同类切换不叠层：关场景浮窗、换角色浮窗
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
