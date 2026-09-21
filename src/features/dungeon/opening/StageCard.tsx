/**
 * 场景卡的三态。开场房的初始化状态**只在这一处表达**（标题行没有第二颗 ↻），所以卡片要能自己
 * 讲清运行中 / 失败 / 就绪。
 */
export type StageCardState = "running" | "failed" | "ready";

const LABELS: Record<StageCardState, string> = {
  running: "场景描述：初始化中",
  failed: "场景描述：重试初始化开场",
  ready: "场景描述：查看场景信息",
};

const TITLES: Record<StageCardState, string> = {
  running: "正在初始化开场…",
  failed: "点这张卡重试初始化",
  ready: "点这张卡看完整的场景信息（全文在浮窗里）",
};

/**
 * 开场房间的**场景卡**（横置、**固定大小**）。
 *
 * 为什么做成卡片：这一屏的视觉基调是卡片（下面是一排竖置的角色卡），而场景描述原本是一段裸文本，
 * 夹在卡片之间像"插入的一段说明"。横置卡 + 竖置角色卡也正好把两类东西分开：**横 = 场景 / 进度，
 * 竖 = 人**。
 *
 * **固定大小是刻意的**：换房间、初始化前后都不该跳动（原来靠 `min-height` 占位防止跳动，现在由
 * 卡片尺寸直接保证）。所以叙述超出就三行省略，**全文在浮窗里**（`StageInfoDialog`）。
 *
 * 三种状态的可见差异只有正文，卡片骨架始终一样（不会因为状态不同而变形）：
 * - `running`：`进行中…`，**不可点**（此刻没什么可做的）；
 * - `failed`：初始化失败 + 原因，**点整张卡重试**；
 * - `ready`：环境叙述，**点整张卡看全文**。
 *
 * 无障碍名统一以可见的「场景描述」开头（`场景描述：…`），既让读屏器有上下文，也让动作名唯一
 * （开场房不再有第二处同动作入口）。
 */
export default function StageCard({
  state,
  body,
  onActivate,
}: {
  state: StageCardState;
  /** 卡面正文：进行中 / 失败原因 / 环境叙述（超出三行省略）。 */
  body: string;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      className={`stage-card stage-card--${state}`}
      aria-label={LABELS[state]}
      title={TITLES[state]}
      disabled={state === "running"}
      onClick={onActivate}
    >
      <span className="stage-card-label">场景描述</span>
      <span className="stage-card-body">{body}</span>
    </button>
  );
}
