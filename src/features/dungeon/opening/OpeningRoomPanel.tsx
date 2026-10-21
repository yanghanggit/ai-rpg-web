import { useState } from "react";
import type { Schemas } from "../../../api/types";
import { displayName } from "../../../components/displayName";
import { readAssetUrl } from "../../assets/readAssetUrl";
import { useAssetsUrlPrefix } from "../../assets/useAssetsUrlPrefix";
import { firstEntity } from "../../entities/ecs";
import ActorInfoDialog from "../../identity/ActorInfoDialog";
import { readStageInfo } from "../../stage/readStageInfo";
import StageInfoDialog from "../../stage/StageInfoDialog";
import { stageNarrativeBody } from "../../stage/stageNarrativeBody";
import { useStageEntity } from "../../stage/useStageEntity";
import type { DungeonParty } from "../useDungeonParty";
import { hasUnclaimedRewards } from "./hasUnclaimedRewards";
import SpoilsDialog from "./SpoilsDialog";
import type { OpeningInit } from "./useOpeningInit";
import type { SpoilsActions } from "./useSpoilsActions";
export type OpeningRoom = Schemas["OpeningRoom"];

/** 对话框的三态：进行中 / 初始化失败 / 就绪（就绪时它同时是本间的主行动：生成奖励 → 查看全文）。 */
type NarrativeState = "running" | "failed" | "ready";

/** 对话框此刻点下去会发生什么：客户端的状态守卫（初始化 → 生成奖励 → 查看全文）。 */
type BoxAction = "running" | "retry" | "generate" | "view";

const BOX_LABELS: Record<BoxAction, { aria: string; visible: string }> = {
  running: { aria: "初始化中", visible: "初始化中…" },
  retry: { aria: "重试初始化", visible: "重试初始化" },
  generate: { aria: "生成奖励", visible: "生成奖励" },
  view: { aria: "查看场景", visible: "查看场景" },
};

const BOX_HINTS: Record<BoxAction, string> = {
  running: "正在初始化开场…",
  retry: "初始化没成功：点这里重试",
  generate: "为队伍每人生成候选牌（候选牌在浮窗里挑）",
  view: "点这里看完整的场景信息（全文在浮窗里）",
};

/** 一个对话选项：动作名 + 会发生什么（与《杀戮尖塔》的事件选项同一套读法）。 */
interface EventChoice {
  key: string;
  title: string;
  effect: string;
  /** 无障碍名与悬停说明。 */
  label: string;
  hint: string;
  /** 提醒色：再做这一步就会失去什么。 */
  warn?: boolean;
  /** 「!」：这里还有东西等你拿。 */
  mark?: boolean;
  disabled?: boolean;
  onActivate: () => void;
}

/**
 * 开场房的正文：**一大张背景 + 一个对话框 + 一串对话选项**（没有角色卡）。
 *
 * 对话框就是本间的主行动：初始化 → 生成奖励 → 查看场景，动作词写在框里右下角，顺序只由
 * 客户端状态守卫排。选项一列、去向永远最后一个，队伍只以「奖励选项」出现（每人一个 → `SpoilsDialog`）。
 * 数据 / 动作都从 props 进来，这一层只排版与措辞。
 */
export default function OpeningRoomPanel({
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
  room: OpeningRoom;
  /** 开场初始化（页面持有的唯一实例）。 */
  openingInit: OpeningInit;
  /** 奖励（生成 / 领卡）：服务端按「当前是非战斗房间」判定，客户端目前只有开场房这一个使用者。 */
  spoils: SpoilsActions;
  /** 本间所有动作合并的忙状态（初始化 + 奖励）。 */
  busy: boolean;
  /** 本次副本固化的队伍与奖励（页面取一次传下来）：奖励选项按成员排。 */
  party: DungeonParty;
  /** 本间的去向（回地图 / 离开副本），这张选项是它在本屏的唯一入口。 */
  finish: { caption: string; hint: string; onActivate: () => void };
}) {
  const stage = useStageEntity(userName, gameName, room.stage.name);
  const assetsUrlPrefix = useAssetsUrlPrefix();
  const illustration = readAssetUrl(room.stage.assets, "illustration", assetsUrlPrefix);

  const [isStageOpen, setIsStageOpen] = useState(false);
  const [spoilsMember, setSpoilsMember] = useState<string | null>(null);
  const [infoActor, setInfoActor] = useState<string | null>(null);

  const stageEntity = firstEntity(stage.data?.entities ?? {});
  const narrative = stageEntity === undefined ? null : readStageInfo(stageEntity).narrative;

  const spoilsOf = party.party.find((member) => member.name === spoilsMember)?.spoils ?? null;

  // 未领奖励在结束本间后永久失去，所以「结束本间」与奖励选项用同一判据变提醒色
  const unclaimed = party.party.some(hasUnclaimedRewards);

  // 奖励是**整队一次**生成的（服务端一次给全队挂 SpoilsComponent），所以看「有没有人有」就够了。
  const spoilsGenerated = party.party.some((member) => member.spoils !== null);

  // 初始化失败 → 失败；无叙事 → 进行中；有叙事 → 就绪。
  const narrativeState: NarrativeState =
    openingInit.error !== null ? "failed" : narrative === null ? "running" : "ready";

  // 对话框就是本间的主行动：同一个按钮顺着 初始化 → 生成奖励 → 查看全文 走，
  // 所以顺序不靠服务端守卫（服务端本来也不拦：不生成奖励直接结束/推进也允许）。
  const boxAction: BoxAction =
    narrativeState === "running"
      ? "running"
      : narrativeState === "failed"
        ? "retry"
        : spoilsGenerated
          ? "view"
          : "generate";

  const boxBody =
    narrativeState === "failed"
      ? `初始化失败：${openingInit.error}`
      : narrative === null
        ? "进行中…"
        : stageNarrativeBody(narrative, stage);

  function activateBox(): void {
    switch (boxAction) {
      case "retry":
        openingInit.start();
        return;
      case "generate":
        spoils.spoils.start();
        return;
      case "view":
        setIsStageOpen(true);
        return;
      case "running":
        return;
    }
  }

  const finishLabel = "结束开局准备";

  /** 选项清单：奖励类在前，去向永远是最后一个。 */
  const choices: EventChoice[] = [];

  // 「生成奖励」在对话框上（本间的主行动）；生成之后才按成员各给一个选项
  // （领取 / 回看是按成员各自算的）。
  if (spoilsGenerated) {
    for (const member of party.party) {
      const pending = hasUnclaimedRewards(member);
      const claimedCount = member.spoils?.claimedCards.length ?? 0;
      const candidates = member.spoils?.candidateCards.length ?? 0;
      choices.push({
        key: `spoils:${member.name}`,
        title: claimedCount > 0 ? "查看奖励" : "获取奖励",
        effect: [
          displayName(member.name),
          `候选 ${candidates} 张`,
          claimedCount > 0 ? `已领 ${claimedCount} 张` : null,
        ]
          .filter((part) => part !== null)
          .join(" · "),
        label: `${claimedCount > 0 ? "查看奖励" : "获取奖励"}：${displayName(member.name)}`,
        hint: pending
          ? "还有候选卡未领：结束本间后就无法再领取了。"
          : "本成员的奖励（已领取的也可以回看）",
        mark: pending,
        warn: pending,
        onActivate: () => setSpoilsMember(member.name),
      });
    }
  }

  choices.push({
    key: "finish",
    title: finishLabel,
    effect: finish.caption,
    label: `${finishLabel}（${finish.caption}）`,
    hint: unclaimed ? "还有候选卡未领，结束本间后就无法再领取了。" : finish.hint,
    warn: unclaimed,
    onActivate: finish.onActivate,
  });

  return (
    <>
      <section className="event-screen" aria-label="房间正文">
        {illustration === null ? (
          <div className="event-backdrop event-backdrop--empty" aria-hidden="true" />
        ) : (
          <img className="event-backdrop" src={illustration} alt="" aria-hidden="true" />
        )}

        <div className="event-stage">
          <button
            type="button"
            className={`event-narrative event-narrative--${narrativeState}`}
            aria-label={`${BOX_LABELS[boxAction].aria}：${displayName(room.stage.name)}`}
            title={BOX_HINTS[boxAction]}
            // 初始化中 / 生成奖励进行中：没有可点的东西（忙状态不叠第二次请求）
            disabled={boxAction === "running" || spoils.spoils.isBusy}
            onClick={activateBox}
          >
            <span className="event-narrative-label">场景描述</span>
            <span className="event-narrative-body">{boxBody}</span>
            {/* 进行中不给动作词：这一帧没什么可点的，写上去只是重复一次"在跑" */}
            {boxAction === "running" ? null : (
              <span className="event-narrative-action">
                {boxAction === "generate" && spoils.spoils.isBusy
                  ? "生成中…"
                  : BOX_LABELS[boxAction].visible}{" "}
                →
              </span>
            )}
          </button>

          {party.isPending ? <p className="event-note">加载队伍…</p> : null}
          {party.isError ? (
            <p className="event-note event-note--error">无法获取队伍状态：{String(party.error)}</p>
          ) : null}
          {/* 初始化失败写在对话框里，这里只说生成奖励那一支；领卡失败在奖励浮窗内显示 */}
          {spoils.spoils.error ? (
            <p className="event-note event-note--error">生成奖励失败：{spoils.spoils.error}</p>
          ) : null}

          <ul className="event-choices">
            {choices.map((choice) => (
              <li key={choice.key}>
                <button
                  type="button"
                  className={`event-choice${choice.warn === true ? " event-choice--warn" : ""}`}
                  aria-label={choice.label}
                  title={`${choice.label} —— ${choice.hint}`}
                  disabled={choice.disabled === true}
                  onClick={choice.onActivate}
                >
                  <span className="event-choice-title">{choice.title}</span>
                  <span className="event-choice-effect">{choice.effect}</span>
                  {choice.mark === true ? (
                    <span className="button-mark" aria-hidden="true">
                      !
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
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
