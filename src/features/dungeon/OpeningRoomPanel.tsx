import { useEffect, useRef, useState } from "react";
import { describeApiError } from "../../api/describeApiError";
import type { Schemas } from "../../api/types";
import { displayName } from "../../components/displayName";
import CardItem from "../cards/CardItem";
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
 * 三块内容，对应玩家的实际流程「初始化 → 生成奖励 → 领卡 → 进入下一关」：
 * - 场景环境叙述（当前场景的 `EnvironmentComponent`）：**始终占位**的固定区（加载中 / 空也保留
 *   高度，避免下方按钮与内容跳动），放在动作按钮上方；
 * - 当前该做的动作按钮；
 * - 队伍准备：每个成员一段，奖励候选 3 张（各带「挑选」），牌组点开浮窗看。
 *
 * **初始化自动跑一次**：进入开场房间后，若 `room.initialized === false` 就自动发一次初始化任务；
 * 失败不自动重试，把「初始化开场」按钮留给玩家手动重试（服务端要求先初始化才能推进 / 退出）。
 *
 * 这里**只放开场房间独有的东西**——标题、副本信息、叙事入口、离开副本属于外层框架
 * （`DungeonRoomPage`），不在这一层重复。
 *
 * 注意这一层的「叙事」二字指场景环境叙述（`opening-narrative` 段），与按钮打开的
 * 「全部叙事」（会话事件流，外层 `NarrativeButton`）不是同一份数据。
 *
 * 「挑选」不做二次确认：奖励标题写明「3 选 1，其余作废」，防误触靠**显式按钮**而不是弹窗
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

  // 自动初始化只对「本房间」触发一次：ref 记住已触发过的房间标识——StrictMode 下 effect 跑两次、
  // 或轮询导致重渲染都不会重复发任务；失败后由玩家点按钮重试，不会自己再发。
  const autoInitRoom = useRef<string | null>(null);
  const roomId = `${userName}\u0000${gameName}\u0000${room.stage.name}`;

  // 正在看牌组的成员（原始名）；非空即打开牌组浮窗
  const [deckMember, setDeckMember] = useState<string | null>(null);
  // 是否打开「进入下一关」确认框
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);

  // 进入开场房间自动执行一次初始化（失败不自动重试）
  useEffect(() => {
    if (room.initialized || autoInitRoom.current === roomId) {
      return;
    }
    autoInitRoom.current = roomId;
    actions.init.start();
  }, [actions, room.initialized, roomId]);

  const narrative =
    stage.data?.entities[0] === undefined ? null : readStageInfo(stage.data.entities[0]).narrative;

  const dungeon = run.data?.dungeon ?? null;
  const currentIndex = dungeon?.current_room_index ?? -1;
  const nextRoom = dungeon === null ? null : (dungeon.rooms[currentIndex + 1] ?? null);

  const spoilsGenerated = party.party.some((member) => member.spoils !== null);
  const spoilsPending = party.party.some(
    (member) => member.spoils !== null && !member.spoils.claimed,
  );
  const deckCards = party.party.find((member) => member.name === deckMember)?.deck ?? [];

  // 开场动作失败的原因（三个动作共用一条文案位置：它们本就串行）
  const actionError = actions.init.error ?? actions.spoils.error ?? actions.pickCard.error;

  return (
    <>
      {/* 环境叙述固定区：始终占位（加载中 / 空也保留高度），避免下方内容跳动 */}
      <section className="opening-narrative" aria-label="环境叙述">
        {stage.isPending ? <p className="muted">加载中…</p> : null}
        {stage.isError ? (
          <p className="error">无法获取环境叙述：{describeApiError(stage.error)}</p>
        ) : null}
        {stage.isSuccess ? (
          narrative === null ? (
            <p className="muted">（暂无环境叙述）</p>
          ) : (
            <p>{narrative}</p>
          )
        ) : null}
      </section>

      <div className="toolbar">
        {/* 初始化与奖励是顺序动作：做完就不再出现，页面上永远只有「当前该做的那一步」；
            初始化已自动触发，这个按钮只在失败后作为手动重试入口保留。 */}
        {room.initialized ? null : (
          <button type="button" disabled={actions.isBusy} onClick={actions.init.start}>
            {actions.init.isBusy ? "初始化中…" : "初始化开场"}
          </button>
        )}
        {room.initialized && !spoilsGenerated ? (
          <button type="button" disabled={actions.isBusy} onClick={actions.spoils.start}>
            {actions.spoils.isBusy ? "生成中…" : "生成奖励"}
          </button>
        ) : null}
        {/* 服务端要求开场房先初始化才能推进（否则 409），所以未初始化时直接禁用 */}
        <button type="button" disabled={!room.initialized} onClick={() => setIsAdvanceOpen(true)}>
          进入下一关
        </button>
      </div>

      {!room.initialized && !actions.init.isBusy ? (
        <p className="muted">开场房间尚未初始化，无法进入下一关。</p>
      ) : null}
      {actionError ? <p className="error">开场动作失败：{actionError}</p> : null}
      {party.isError ? <p className="error">无法获取队伍状态：{String(party.error)}</p> : null}

      <section aria-labelledby="opening-party-heading">
        <div className="section-head">
          <h2 id="opening-party-heading">队伍准备</h2>
          <span className="muted">奖励 3 选 1，挑走一张后其余作废</span>
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

            {member.spoils === null ? (
              <p className="muted">（尚未生成奖励）</p>
            ) : (
              <>
                {member.spoils.claimed ? (
                  <p className="muted">（已领取，以下为本次候选，仅供参考）</p>
                ) : null}
                <ul className="card-tiles">
                  {member.spoils.cards.map((card) => (
                    <CardItem
                      key={card.uuid}
                      card={card}
                      action={
                        member.spoils?.claimed ? null : (
                          <button
                            type="button"
                            disabled={actions.isBusy}
                            aria-label={`挑选 ${card.name}`}
                            onClick={() => actions.pickCard.start(member.name, card.name)}
                          >
                            挑选
                          </button>
                        )
                      }
                    />
                  ))}
                </ul>
              </>
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
          spoilsPending={spoilsPending}
          busy={advance.isPending}
          error={advance.isError ? describeApiError(advance.error) : null}
          onConfirm={() => advance.mutate()}
          onClose={() => {
            advance.reset();
            setIsAdvanceOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
