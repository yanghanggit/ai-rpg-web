import { displayName } from "../../components/displayName";

/** 场景卡三态；开场房的初始化三态只在这一处表达。 */
export type StageCardState = "running" | "failed" | "ready";

/** 各态的动作词（无障碍名 = `<动作>：<场景名>`，与角色卡同一套措辞）。 */
const ACTIONS: Record<StageCardState, string> = {
  running: "初始化中",
  failed: "重试初始化",
  ready: "查看场景",
};

const TITLES: Record<StageCardState, string> = {
  running: "正在初始化开场…",
  failed: "点这张卡重试初始化",
  ready: "点这张卡看完整的场景信息（全文在浮窗里）",
};

/**
 * 横置的场景卡（dungeon 内唯一实现，开场房与战斗开局共用）。
 *
 * 与角色卡共用同一副足迹、只是转 90°；固定大小，叙述超出三行省略、全文在浮窗里。
 * 三态：`running` 不可点、`failed` 点整卡重试、`ready` 点整卡看全文。`name` 只用于拼无障碍名。
 */
export default function StageCard({
  state,
  name,
  body,
  onActivate,
}: {
  state: StageCardState;
  /** 场景原始名（`room.stage.name`）：拼无障碍名用，显示名交给 `displayName`。 */
  name: string;
  /** 卡面正文：进行中 / 失败原因 / 环境叙述（超出三行省略）。 */
  body: string;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      className={`stage-card stage-card--${state}`}
      aria-label={`${ACTIONS[state]}：${displayName(name)}`}
      title={TITLES[state]}
      disabled={state === "running"}
      onClick={onActivate}
    >
      <span className="stage-card-label">场景描述</span>
      <span className="stage-card-body">{body}</span>
    </button>
  );
}
