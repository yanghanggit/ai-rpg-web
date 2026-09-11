import { useState } from "react";
import { Link } from "react-router";
import { $api } from "../api/query";
import { useTask } from "../api/useTask";

/**
 * 开发索引页（仅 dev 注册）。
 *
 * 把常用深链列成可点的清单：配合 `pnpm dev:mock` 用 mock 数据，
 * 或 `pnpm dev` 时用真实后端（需该 user/game 已存在）。
 */
const links = [
  { to: "/", label: "启动屏 LaunchPage" },
  { to: "/entry", label: "玩家入口 EntryPage" },
  { to: "/game/webdev/Game1/home", label: "家园 HomePage" },
];

export default function DevIndexPage() {
  return (
    <main className="page">
      <h1>开发索引</h1>
      <p className="muted">
        仅 dev 下注册。配合 <code>pnpm dev:mock</code> 可跳过全部正式流程直接查看页面。
      </p>
      <ul className="plain">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to}>{link.label}</Link> <span className="muted mono">{link.to}</span>
          </li>
        ))}
      </ul>

      <TaskPollingPanel />
    </main>
  );
}

/**
 * 任务轮询面板：`useTask` 的手动验收入口。
 *
 * 触发后端自带的测试接口 `/api/tasks/v1/trigger`（只 sleep，无副作用），
 * 观察 `running → completed`。mock 模式下 2 秒完成，真实后端约 5 秒。
 */
function TaskPollingPanel() {
  const [jobId, setJobId] = useState<string | null>(null);
  const task = useTask(jobId);
  const trigger = $api.useMutation("post", "/api/tasks/v1/trigger");

  return (
    <section className="card" style={{ marginTop: "2.5rem" }}>
      <h2>后台任务轮询（useTask）</h2>
      <p className="muted">触发一个无副作用的后台任务，验证「触发 → 轮询 → 终态」这条链路。</p>

      <button
        type="button"
        disabled={trigger.isPending || task.isRunning}
        onClick={() => {
          trigger.mutate({}, { onSuccess: (data) => setJobId(data.job_id) });
        }}
      >
        {task.isRunning ? "任务进行中…" : "触发后台任务"}
      </button>

      <dl className="facts">
        <dt>job_id</dt>
        <dd className="mono">{jobId ?? "—"}</dd>

        <dt>任务状态</dt>
        <dd>
          {task.isCompleted ? <span className="ok">completed</span> : null}
          {task.isFailed ? (
            <span className="error">failed · {task.error ?? "无错误信息"}</span>
          ) : null}
          {task.isTimedOut ? <span className="error">超时（已停止轮询）</span> : null}
          {jobId == null ? <span className="muted">未触发</span> : null}
          {jobId != null && task.isRunning ? <span className="muted">running…</span> : null}
        </dd>
      </dl>

      {trigger.isError ? <p className="error">触发失败：{String(trigger.error)}</p> : null}
      {task.pollError ? <p className="error">轮询失败：{String(task.pollError)}</p> : null}
    </section>
  );
}
