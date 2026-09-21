/**
 * 开发索引页（仅 dev 注册）。
 *
 * 把常用深链列成可点的清单：配合 `pnpm dev:mock` 用 mock 数据，
 * 或 `pnpm dev` 时用真实后端（需该 user/game 已存在）。
 *
 * 这里一律用**普通 `<a>`**（整页加载），而不是 react-router 的 `<Link>`：带 `?seed=` 的深链
 * 需要重跑 `main.tsx::enableMocking` 才能把 mock 状态造出来（见 `mocks/seedMockFromUrl`），
 * 而 SPA 跳转不会重跑 boot。顺带的好处是每次进来都是全新的 mock 内存态。
 *
 * **副本进行中只有两屏**：地图（`/dungeon/map`，**房间之间那一站**——刚进入副本、以及某个房间
 * 结束后都停在那里）与房间（`/dungeon/room`，开场房 / 战斗房都在这一条路由里，按服务端给的
 * `room.type` 分发）。
 *
 * 地图只列**三种状态**（其余都是不可能的，所以这里也没有对应深链）：刚进入副本（还没进第 1 间）、
 * 两间之间（本间已结束、还有下一间）、以及"没有可前往的房间"的兜底（正常流程走不到，房间的结束
 * 动作会直接离开副本）。战斗没结束时地图会被转发回房间，所以没有"战斗未结束的地图"这种链接。
 */
const links = [
  { to: "/", label: "启动屏 LaunchPage" },
  { to: "/lobby", label: "玩家入口 LobbyPage" },
  { to: "/game/webdev/Game1/home", label: "家园概览 HomeOverviewPage" },
  { to: "/game/webdev/Game1/dungeon", label: "副本总览 DungeonOverviewPage" },
  {
    to: "/game/webdev/Game1/dungeon/map?seed=opening:fresh",
    label: "副本地图 · 刚进入副本（还没进第 1 间）",
  },
  {
    to: "/game/webdev/Game1/dungeon/map?seed=party:full",
    label: "副本地图 · 下一个房间前（队伍带同伴）",
  },
  {
    to: "/game/webdev/Game1/dungeon/room?seed=opening:init-failed",
    label: "开场房间 · 初始化失败",
  },
  { to: "/game/webdev/Game1/dungeon/room?seed=opening:ready", label: "开场房间 · 已初始化" },
  { to: "/game/webdev/Game1/dungeon/room?seed=opening:spoils", label: "开场房间 · 已生成奖励" },
  { to: "/game/webdev/Game1/dungeon/room?seed=opening:claimed", label: "开场房间 · 已领奖励" },
  { to: "/game/webdev/Game1/dungeon/room?seed=party:full", label: "开场房间 · 队伍带同伴" },
  { to: "/game/webdev/Game1/dungeon/room?seed=combat:init", label: "战斗房间 · 初始化" },
  { to: "/game/webdev/Game1/dungeon/room?seed=combat:round_start", label: "战斗房间 · 抓牌" },
  { to: "/game/webdev/Game1/dungeon/room?seed=combat:turn", label: "战斗房间 · 出牌" },
  { to: "/game/webdev/Game1/dungeon/room?seed=combat:post", label: "战斗房间 · 结算" },
];

export default function DevIndexPage() {
  return (
    <main className="page page--wide">
      <h1>开发索引</h1>
      <p className="muted">
        仅 dev 下注册。配合 <code>pnpm dev:mock</code> 可跳过全部正式流程直接查看页面；
        <code>?seed=</code> 的链接会用 mock 直接造出对应开场 / 战斗状态。
      </p>
      <ul className="plain link-grid">
        {links.map((link) => (
          <li key={link.to}>
            <a href={link.to}>{link.label}</a> <span className="muted mono">{link.to}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
