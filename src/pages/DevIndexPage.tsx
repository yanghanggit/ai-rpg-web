/**
 * 开发索引页（仅 dev 注册）：按屏分组列常用深链。
 *
 * 一律用普通 `<a>`（整页加载）：带 `?seed=` 的深链需要重跑 `enableMocking`（SPA 跳转不会重跑），
 * 顺带每次进来都是全新的 mock 内存态。
 */
const GAME = "/game/webdev/Game1";
const ROOM = `${GAME}/dungeon/room`;
const MAP = `${GAME}/dungeon/map`;

interface DevLink {
  to: string;
  label: string;
}

interface DevSection {
  title: string;
  links: DevLink[];
}

const sections: DevSection[] = [
  {
    title: "入口",
    links: [
      { to: "/", label: "启动屏 LaunchPage" },
      { to: "/lobby", label: "玩家入口 LobbyPage" },
    ],
  },
  {
    title: "家园",
    links: [{ to: `${GAME}/home`, label: "家园概览 HomeOverviewPage" }],
  },
  {
    title: "副本 · 总览与地图",
    links: [
      { to: `${GAME}/dungeon`, label: "副本总览 DungeonOverviewPage" },
      { to: `${MAP}?seed=opening:fresh`, label: "地图 · 刚进入副本（第 1 间待进入）" },
      { to: `${MAP}?seed=opening:ended`, label: "地图 · 第 1 间已结束（按钮在下一间）" },
      { to: `${MAP}?seed=party:full`, label: "地图 · 刚进入副本（队伍带同伴）" },
    ],
  },
  {
    title: "副本 · 开场房间",
    links: [
      { to: `${ROOM}?seed=opening:init-failed`, label: "开场房间 · 初始化失败" },
      { to: `${ROOM}?seed=opening:ready`, label: "开场房间 · 已初始化" },
      { to: `${ROOM}?seed=opening:spoils`, label: "开场房间 · 已生成奖励" },
      { to: `${ROOM}?seed=opening:claimed`, label: "开场房间 · 已领奖励" },
      { to: `${ROOM}?seed=party:full`, label: "开场房间 · 队伍带同伴" },
    ],
  },
  {
    title: "副本 · 战斗房间",
    links: [
      { to: `${ROOM}?seed=combat:init`, label: "战斗房间 · 初始化中（还没开始）" },
      { to: `${ROOM}?seed=combat:round_start`, label: "战斗房间 · 初始化完成（等待抓牌）" },
      { to: `${ROOM}?seed=combat:turn`, label: "战斗房间 · 玩家出牌" },
      { to: `${ROOM}?seed=combat:monster`, label: "战斗房间 · 怪物出牌" },
      { to: `${ROOM}?seed=combat:post`, label: "战斗房间 · 结算（战斗胜利）" },
      { to: `${ROOM}?seed=combat:defeat`, label: "战斗房间 · 结算（战斗失败）" },
    ],
  },
];

export default function DevIndexPage() {
  return (
    <main className="page page--wide">
      <h1>开发索引</h1>
      <p className="muted">
        仅 dev 下注册。配合 <code>pnpm dev:mock</code> 可跳过全部正式流程直接查看页面；
        <code>?seed=</code> 的链接会用 mock 直接造出对应开场 / 战斗状态。
      </p>
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <ul className="plain link-grid">
            {section.links.map((link) => (
              <li key={link.to}>
                <a href={link.to}>{link.label}</a> <span className="muted mono">{link.to}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
