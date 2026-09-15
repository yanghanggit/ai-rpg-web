import { useState } from "react";
import { describeApiError } from "../../api/describeApiError";
import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import CardItem from "../cards/CardItem";
import NarrativeOverlay from "../session/NarrativeOverlay";
import { useSessionMessages } from "../session/useSessionMessages";
import { readStageInfo } from "../stage/readStageInfo";
import { useStageEntity } from "../stage/useStageEntity";
import AdvanceRoomDialog from "./AdvanceRoomDialog";
import DeckDialog from "./DeckDialog";
import { useAdvanceStage } from "./useAdvanceStage";
import { useDungeonRun } from "./useDungeonRun";
import { useOpeningActions } from "./useOpeningActions";
import { useOpeningParty } from "./useOpeningParty";
/**
 * 开场房间的房间主体（`room.type === "opening"`）。
 *
 * 三块内容，对应玩家的实际流程「初始化 → 生成卡池 → 挑卡 → 进入下一关」：
 * - 场景环境叙述（当前场景的 `EnvironmentComponent`，副本初始化时生成）；
 * - 三个动作按钮 + 叙事入口；
 * - 队伍准备：每个成员一段，卡池候选 3 张（各带「挑选」），牌组点开浮窗看。
 *
 * 这里**只放开场房间独有的东西**——标题、副本信息、离开副本属于外层框架
 * （`DungeonRoomPage`），不在这一层重复。
 *
 * 「挑选」不做二次确认：卡池标题写明「3 选 1，其余作废」，防误触靠**显式按钮**而不是弹窗
 * （与队伍名单的「加入 / 移出」同一套心智）。
 */
export default function OpeningRoomPanel({
  userName,
  gameName,
  room,
}: {
  userName: string;
  gameName: string;
  room: Schemas["OpeningRoom"];
}) {
  const stage = useStageEntity(userName, gameName, room.stage.name);
  const party = useOpeningParty(userName, gameName);
  const actions = useOpeningActions(userName, gameName);
  const advance = useAdvanceStage(userName, gameName);
  const run = useDungeonRun(userName, gameName);
  const session = useSessionMessages(userName, gameName);

  // 正在看牌组的成员（原始名）；非空即打开牌组浮窗
  const [deckMember, setDeckMember] = useState<string | null>(null);
  // 是否打开「进入下一关」确认框
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
  // 是否打开叙事浮层
  const [isNarrativeOpen, setIsNarrativeOpen] = useState(false);

  const narrative =
    stage.data?.entities[0] === undefined ? null : readStageInfo(stage.data.entities[0]).narrative;

  const dungeon = run.data?.dungeon ?? null;
  const currentIndex = dungeon?.current_room_index ?? -1;
  const nextRoom = dungeon === null ? null : (dungeon.rooms[currentIndex + 1] ?? null);

  const poolReady = party.party.some((member) => member.pool !== null);
  const deckCards = party.party.find((member) => member.name === deckMember)?.deck ?? [];

  // 开场动作失败的原因（三个动作共用一条文案位置：它们本就串行）
  const actionError = actions.init.error ?? actions.pool.error ?? actions.pick.error;

  return (
    <>
      {narrative === null ? null : <p className="opening-narrative">{narrative}</p>}

      <div className="toolbar">
        {/* 初始化与卡池是顺序动作：做完就不再出现，页面上永远只有「当前该做的那一步」 */}
        {room.initialized ? null : (
          <button type="button" disabled={actions.isBusy} onClick={actions.init.start}>
            {actions.init.isBusy ? "初始化中…" : "初始化开场"}
          </button>
        )}
        {room.initialized && !poolReady ? (
          <button type="button" disabled={actions.isBusy} onClick={actions.pool.start}>
            {actions.pool.isBusy ? "生成中…" : "生成卡池"}
          </button>
        ) : null}
        <button type="button" onClick={() => setIsAdvanceOpen(true)}>
          进入下一关
        </button>
        <button type="button" onClick={() => setIsNarrativeOpen(true)}>
          叙事
        </button>
      </div>

      {actionError ? <p className="error">开场动作失败：{actionError}</p> : null}
      {party.isError ? <p className="error">无法获取队伍状态：{String(party.error)}</p> : null}

      <section aria-labelledby="opening-party-heading">
        <div className="section-head">
          <h2 id="opening-party-heading">队伍准备</h2>
          <span className="muted">卡池 3 选 1，挑走一张后其余作废</span>
        </div>

        {party.isPending ? <p className="muted">加载中…</p> : null}

        {party.party.map((member) => (
          <section key={member.name} className="opening-member">
            <div className="section-head">
              <h3>
                {displayName(member.name)}
                {member.player ? <span className="badge">你</span> : null}
              </h3>
              <span className="muted">牌组 {member.deck.length} 张</span>
              <button type="button" onClick={() => setDeckMember(member.name)}>
                查看牌组
              </button>
            </div>

            {member.pool === null ? (
              // 卡池是一次性给**全体**成员的，所以「别人还有候选、这个人没有」只可能是这个人已经挑过
              <p className="muted">{poolReady ? "（已挑过，卡池已清空）" : "（尚未生成卡池）"}</p>
            ) : (
              <ul className="card-tiles">
                {member.pool.map((card) => (
                  <CardItem
                    key={card.uuid}
                    card={card}
                    action={
                      <button
                        type="button"
                        disabled={actions.isBusy}
                        aria-label={`挑选 ${card.name}`}
                        onClick={() => actions.pick.start(member.name, card.name)}
                      >
                        挑选
                      </button>
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </section>

      {deckMember === null ? null : (
        <DeckDialog memberName={deckMember} cards={deckCards} onClose={() => setDeckMember(null)} />
      )}

      {isAdvanceOpen ? (
        <AdvanceRoomDialog
          currentRoomName={room.stage.name}
          nextRoom={nextRoom}
          initialized={room.initialized}
          poolReady={poolReady}
          busy={advance.isPending}
          error={advance.isError ? describeApiError(advance.error) : null}
          onConfirm={() => advance.mutate()}
          onClose={() => {
            advance.reset();
            setIsAdvanceOpen(false);
          }}
        />
      ) : null}

      {isNarrativeOpen ? (
        <NarrativeOverlay messages={session.messages} onClose={() => setIsNarrativeOpen(false)} />
      ) : null}
    </>
  );
}
