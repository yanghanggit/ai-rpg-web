/**
 * 动作浮窗：服务端跑这一次动作期间盖住战场（几秒到十几秒），结束后把这次新增的回合条目显示出来。
 *
 * 两态同框：`running` 只有一句"在算"，`settled` 换成本次产出的条目。状态（含"没有条目就收窗"）
 * 由 `useActionReport` 持有，本组件只负责画。
 */
import Modal from "../../../components/Modal";
import { RoundEntryList } from "./CombatRoundLog";
import type { ActionReport } from "./useActionReport";

export default function ActionReportDialog({
  report,
  onClose,
}: {
  /** `null` = 没在跑也没有待看的战报（不渲染）。 */
  report: ActionReport | null;
  onClose: () => void;
}) {
  if (report === null) {
    return null;
  }

  const running = report.phase === "running";
  return (
    <Modal title={report.label} meta={running ? "进行中" : "已结算"} size="sm" onClose={onClose}>
      {running ? (
        <>
          <p className="combat-wait">
            <span className="combat-wait-dot" aria-hidden="true" />
            服务端正在决策与结算…
          </p>
          <p className="muted">通常需要几秒到十几秒；结果出来会自动显示在这里。</p>
        </>
      ) : (
        <>
          <RoundEntryList entries={report.entries} />
          <div className="toolbar">
            <button type="button" onClick={onClose}>
              继续
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
