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
import type { OpeningInit } from "./useOpeningInit";
import type { SpoilsActions } from "./useSpoilsActions";

/** 非战斗房间（当前仅 `opening`；`combat` 之外的类型都落在这里）。 */
export type NonCombatRoom = Exclude<Schemas["DungeonRoomResponse"]["room"], Schemas["CombatRoom"]>;

/**
 * 非战斗房间的房间主体——**奖励入口属于这一层**（与服务端「非战斗房间」守卫一致），
 * 与具体房间类型（开场房 / 未来的其它非战斗房）无关。
 *
 * 三块：横置的场景卡（开场房有初始化三态：进行中 → 失败可点重试 → 就绪可点看全文；就绪与否看
 * 叙事是否生成）、右侧「结束本间」卡（非战斗房间无完成态，随时可离开）、下面一排竖置的角色卡
 * （整卡开角色信息，卡底按钮是奖励入口，三态：生成奖励 → 获取奖励 → 查看奖励）。
 *
 * 开场专属的部分（`opening-init` 的三态、自动初始化）只在 `room.type === "opening"` 时生效；
 * 其它非战斗房只展示叙事 + 奖励 + 结束本间。
 */
export default function NonCombatRoomPanel({
  userName,
  gameName,
  room,
  openingInit,
  spoils,
  busy,
  party,
  finish,
}: {
  userName: string;
  gameName: string;
  room: NonCombatRoom;
  /** 开场初始化（仅开场房使用；其它非战斗房忽略）。 */
  openingInit: OpeningInit;
  /** 奖励（生成 / 领卡）——非战斗房通用。 */
  spoils: SpoilsActions;
  /** 本间所有动作合并的忙状态（初始化 + 奖励），界面一次只放一个。 */
  busy: boolean;
  /** 本次副本固化的队伍与奖励（页面取一次传下来）：角色卡的内容。 */
  party: DungeonParty;
  /** 本间的结束动作（回地图 / 离开副本），这张卡是它在本屏的唯一入口。 */
  finish: { caption: string; hint: string; onActivate: () => void };
}) {
  const isOpening = room.type === "opening";
  const stage = useStageEntity(userName, gameName, room.stage.name);

  const [isStageOpen, setIsStageOpen] = useState(false);
  const [spoilsMember, setSpoilsMember] = useState<string | null>(null);
  const [infoActor, setInfoActor] = useState<string | null>(null);

  const stageEntity = firstEntity(stage.data?.entities ?? {});
  const narrative = stageEntity === undefined ? null : readStageInfo(stageEntity).narrative;

  const spoilsOf = party.party.find((member) => member.name === spoilsMember)?.spoils ?? null;

  // 未领奖励在结束本间后永久失去，所以「结束本间」与角色卡按钮用同一判据变提醒色
  const unclaimed = party.party.some(hasUnclaimedRewards);

  // 开场房：初始化失败 → 失败；无叙事 → 进行中；有叙事 → 就绪。
  // 其它非战斗房不跑初始化：有叙事即就绪，否则进行中。
  const stageState: StageCardState = isOpening
    ? openingInit.error !== null
      ? "failed"
      : narrative === null
        ? "running"
        : "ready"
    : narrative === null
      ? "running"
      : "ready";
  const stageBody =
    stageState === "failed"
      ? `初始化失败：${openingInit.error}`
      : stageState === "running"
        ? "进行中…"
        : stageNarrativeBody(narrative, stage);

  // 开场房叫「结束开局准备」，其它非战斗房叫「结束本间」
  const finishLabel = isOpening ? "结束开局准备" : "结束本间";

  /** 角色卡按钮的文案：生成奖励 → 获取奖励 → 查看奖励。 */
  function spoilsLabel(member: DungeonPartyMember): string {
    if (member.spoils === null) {
      return spoils.spoils.isBusy ? "生成中…" : "生成奖励";
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
            stageState === "failed" ? () => openingInit.start() : () => setIsStageOpen(true)
          }
        />

        {/* 本间结束动作的唯一入口（非战斗房间无完成态，随时可离开） */}
        <button
          type="button"
          className={unclaimed ? "stage-next stage-next--warn" : "stage-next"}
          aria-label={`${finishLabel}（${finish.caption}）`}
          title={`${finishLabel}（${finish.caption}）—— ${
            unclaimed ? "还有候选卡未领，结束本间后就无法再领取了。" : finish.hint
          }`}
          onClick={finish.onActivate}
        >
          <span className="stage-next-arrow" aria-hidden="true">
            →
          </span>
          <span className="stage-next-caption">{finish.caption}</span>
        </button>

        {/* 初始化失败已写在场景卡里，这里只说生成奖励那一支；领卡失败在奖励浮窗内显示 */}
        {spoils.spoils.error ? <p className="error">生成奖励失败：{spoils.spoils.error}</p> : null}
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
                  disabled={busy}
                  title="一次为整队生成奖励（点任何一张卡上的它都一样）"
                  onClick={() => spoils.spoils.start()}
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
          // 本间的「场景内角色」就是这一局的队伍
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
          busy={busy}
          error={spoils.pickCard.error}
          onPick={(cardName) => spoils.pickCard.start(spoilsMember, cardName)}
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
