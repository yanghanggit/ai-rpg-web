import { useEffect, useRef, useState } from "react";
import { describeApiError } from "../../../api/describeApiError";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import { readStageInfo } from "../../stage/readStageInfo";
import { useStageEntity } from "../../stage/useStageEntity";
import SpoilsDialog from "./SpoilsDialog";
import { useOpeningActions } from "./useOpeningActions";
import { useOpeningParty } from "./useOpeningParty";
/**
 * 开场房间的房间主体（`room.type === "opening"`）。
 *
 * 三块内容，对应玩家的实际流程「初始化 → 生成奖励 → 领卡 → 结束本间」：
 * - 场景环境叙述（当前场景的 `EnvironmentComponent`）：**始终占位**的固定区（加载中 / 空也保留
 *   高度，避免下方按钮与内容跳动），放在动作按钮上方；
 * - 当前该做的动作按钮，最后一个是**本间的结束动作**（`onFinishRoom`，回地图）；
 * - **队伍**：竖着的角色卡，一张挨一张横排（顺序即后端给的队伍顺序，玩家在前）——卡面是
 *   「名字 + 属性（HP/ATK/DEF）+ 牌组张数」，点卡上的名字开角色信息浮窗；有奖励时卡上多一个
 *   「奖励」按钮，点开在浮窗里**竖排**候选卡挑选。卡片的形状与牌组 / 奖励里的**卡面同一套**
 *   （窄而高的矩形），横排就是「队伍站位」的 UX 雏形。
 *   **卡上不再有「查看牌组」**：牌组已由标题行的「牌组」入口统一提供（`RoomScaffold`，同一份
 *   `useOpeningParty`），不在房间里再开一个口子——两个入口会各自演化出两份卡面。
 *
 * **初始化自动跑一次**：进入开场房间后，若 `room.initialized === false` 就自动发一次初始化任务；
 * 失败不自动重试，把「初始化开场」按钮留给玩家手动重试（服务端要求先初始化才能推进 / 退出）。
 *
 * **本间是一扇单向门**：结束动作一旦按下就回地图，而**已结束的房间进不去**（地图上不再提供
 * "进入房间"）。奖励候选本来就挂在队伍成员身上、只有当前还是开场房时才能领
 * （`activate_pick_spoils_card` 要求 `is_current_room_dungeon_opening`），所以没领的卡就永久
 * 留在那里——这是设计上要的惩罚，所以这里只**提示不阻止**（数据在这一层，提醒也放在这一层）。
 *
 * 这里**只放开场房间独有的东西**——标题、副本信息、叙事入口、离开副本属于外层框架
 * （`OpeningRoomPage` 的 `RoomScaffold`），不在这一层重复。「进入下一间」属于地图
 * （`map/DungeonMapPanel`）：推进是整局副本的前进动作，不是某个房间的动作。
 *
 * 注意这一层的「叙事」二字指场景环境叙述（`opening-narrative` 段），与按钮打开的
 * 「全部叙事」（会话事件流，外层 `NarrativeButton`）不是同一份数据。
 *
 * **奖励渐进式披露**：不摊在页面上，角色卡上只留「奖励」按钮，点开才展开候选卡。「挑选」
 * 不做二次确认，防误触靠卡片上的显式按钮（与队伍名单的「加入 / 移出」同一套心智）。
 */
export default function OpeningRoomPanel({
  userName,
  gameName,
  room,
  onFinishRoom,
}: {
  userName: string;
  gameName: string;
  room: Schemas["OpeningRoom"];
  /** 本间的结束动作：回地图（由页面接线，本层不认识路由）。 */
  onFinishRoom: () => void;
}) {
  const stage = useStageEntity(userName, gameName, room.stage.name);
  const party = useOpeningParty(userName, gameName);
  const actions = useOpeningActions(userName, gameName);

  // 自动初始化只对「本房间」触发一次：ref 记住已触发过的房间标识——StrictMode 下 effect 跑两次、
  // 或轮询导致重渲染都不会重复发任务；失败后由玩家点按钮重试，不会自己再发。
  const autoInitRoom = useRef<string | null>(null);
  const roomId = `${userName}\u0000${gameName}\u0000${room.stage.name}`;

  // 正在看奖励的成员（原始名）；非空即打开奖励浮窗
  const [spoilsMember, setSpoilsMember] = useState<string | null>(null);
  // 正在看角色信息的成员（原始名）；非空即打开角色信息浮窗
  const [infoActor, setInfoActor] = useState<string | null>(null);

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

  const spoilsGenerated = party.party.some((member) => member.spoils !== null);
  const spoilsPending = party.party.some(
    (member) =>
      member.spoils !== null &&
      member.spoils.candidateCards.length > 0 &&
      member.spoils.claimedCards.length === 0,
  );
  const spoilsOf = party.party.find((member) => member.name === spoilsMember)?.spoils ?? null;

  // 页面级动作失败的原因（初始化 / 生成奖励）；领卡失败在奖励浮窗内显示
  const actionError = actions.init.error ?? actions.spoils.error;

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
        {/* 本间的结束动作：结束即回地图，之后本间进不来——未领的候选卡就留在这里了 */}
        {room.initialized ? (
          <button type="button" disabled={actions.isBusy} onClick={onFinishRoom}>
            结束开局准备
          </button>
        ) : null}
      </div>

      {!room.initialized && !actions.init.isBusy ? (
        <p className="muted">开场房间尚未初始化，结束本间与离开副本都还不行。</p>
      ) : null}
      {room.initialized && spoilsPending ? (
        <p className="muted">还有候选卡未领：结束本间后就无法再领取了。</p>
      ) : null}
      {actionError ? <p className="error">开场动作失败：{actionError}</p> : null}
      {party.isError ? <p className="error">无法获取队伍状态：{String(party.error)}</p> : null}

      <section aria-labelledby="opening-party-heading">
        <div className="section-head">
          <h2 id="opening-party-heading">队伍</h2>
        </div>

        {party.isPending ? <p className="muted">加载中…</p> : null}

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

              {/* 属性是副本里最要紧的状态（血量会变），排在最前；一行一项，横排会被卡宽挤断 */}
              {member.stats === null ? null : (
                <p className="muted actor-card-stats">
                  <span>
                    HP {member.stats.hp}/{member.stats.max_hp}
                  </span>
                  <span>ATK {member.stats.attack}</span>
                  <span>DEF {member.stats.defense}</span>
                </p>
              )}

              <p className="muted">牌组 {member.deck.length} 张</p>

              {/* 奖励候选不摊在页面上：有奖励时卡上多一个「奖励」按钮，点开浮窗看。
                  牌组不在这里开口子——标题行的「牌组」入口已经能看全队（同一份 useOpeningParty）。 */}
              {member.spoils === null ? null : (
                <div className="card-actions">
                  <button type="button" onClick={() => setSpoilsMember(member.name)}>
                    奖励
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

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
