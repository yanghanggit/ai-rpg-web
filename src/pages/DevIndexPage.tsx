import { Link } from "react-router";

/**
 * 开发索引页（仅 dev 注册）。
 *
 * 把常用深链列成可点的清单：配合 `pnpm dev:mock` 用 mock 数据，
 * 或 `pnpm dev` 时用真实后端（需该 user/game 已存在）。
 */
const links = [
  { to: "/", label: "启动屏 LaunchPage" },
  { to: "/entry", label: "玩家入口 EntryPage" },
  { to: "/game/webdev/Game1/home", label: "家园概览 HomeOverviewPage" },
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
    </main>
  );
}
