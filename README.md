# ai-rpg-web

AI-RPG 的 Web 客户端（面向玩家）。

一个**纯前端**项目：只消费后端仓库 `ai-rpg`（FastAPI）的 HTTP 接口，不依赖后端代码、不做 SSR，两者无共享代码。它和后端自带的 `tui/` 是**平行的消费者**——TUI 给后端开发者走查接口，这里是正式玩家入口；唯一的耦合是 API 契约，靠类型生成同步。

## 技术选型

| 项 | 选择 | 理由 |
| ------ | ------ | ------ |
| 构建 | Vite + React + TypeScript（strict） | 生态成熟、开发体验好；SPA 不需要 SSR / SEO |
| 路由 | React Router | **地址即状态**：游戏页带会话参数，可直接深链到任意一层 |
| 服务端状态 | TanStack Query | 天然适配本项目的「命令 → `job_id` → 等任务 → 失效刷新」模式 |
| 客户端状态 | 只用组件内 `useState` | 游戏数据全在 Query 缓存里；纯 UI 状态（浮窗开合）不需要跨组件共享，所以不引入状态库 |
| HTTP / 契约 | openapi-fetch + openapi-react-query + openapi-typescript | 类型从后端 `/openapi.json` 生成，请求方法 / 路径 / 参数 / 响应端到端类型安全 |
| 实时推送 | 任务用 SSE，会话消息用增量轮询 | 与 TUI 一致；不用原生 `EventSource`（无法带鉴权头，且自带重连语义与后端一次性流冲突） |
| 质量 | Biome + Vitest + MSW | lint / format 一个工具；mock handlers 与 `pnpm dev:mock` **共用一套**，不会两边漂移 |
| 明确不引入 | Next.js、状态机、WebSocket、UI 组件库 | 都是当前换不来收益的复杂度：无 SSR 需求、无双向实时需求、样式只有一份 `index.css` |

## 快速开始

```bash
pnpm install
cp .env.example .env      # 按需修改后端地址，默认 http://localhost:8000
pnpm gen:api              # 拉后端 /openapi.json 生成 TS 类型（需后端已启动）
pnpm dev
```

局域网 / 手机真机访问、Mock 模式、深链调试见 [`docs/dev-setup.md`](docs/dev-setup.md)。

## 怎么用

`/` 启动屏（服务器连没连上）→ `/entry` 起名字、选蓝图开局 → `/game/:userName/:gameName/home` 家园。

家园一屏看全局：顶部按钮推进剧情、看叙事 / 角色 / 蓝图 / 道具，「副本」切到单独一屏；下方每个场景一张卡片，角色名可点开信息，可切换玩家所在场景。

URL 自带会话参数（账号 / 对局），可以直接深链到任意一层，不必每次从头走一遍。

## 常用命令

| 命令 | 说明 |
| ------ | ------ |
| `pnpm dev` | 启动开发服务器（连真实后端） |
| `pnpm dev:mock` | 启动开发服务器 + 浏览器端 MSW，用 `src/mocks/fixtures.ts` 假数据调试页面（端口 5273，可与 `pnpm dev` 同时开） |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm preview` | 预览构建产物 |
| `pnpm gen:api` | 从后端 `/openapi.json` 生成 TS 类型到 `src/api/schema.d.ts`（需后端已启动） |
| `pnpm screenshot` | 用 headless Chrome 给页面截图（可指定视口、先点几下再拍），详见 `docs/dev-setup.md` |
| `pnpm format` | Biome 格式化 |
| `pnpm lint` / `pnpm lint:fix` | Biome 静态检查（含文件命名校验）/ 自动修复 |
| `pnpm check:conventions` | 单独跑文件命名 / `.tsx` 位置校验（已包含在 `pnpm lint`） |
| `pnpm check:ports` | 单独跑「dev 端口只有一个来源」校验（已包含在 `pnpm lint`） |
| `pnpm typecheck` | TypeScript 严格类型检查 |
| `pnpm test` / `pnpm test:run` | Vitest 测试（watch / 单次） |

最短的「检查 + 构建 + 启动」三连：

```bash
pnpm install && pnpm gen:api && pnpm typecheck && pnpm lint && pnpm test:run && pnpm build && pnpm dev
```

## 文档

工程细节都在 **[`docs/`](docs/README.md)（唯一入口，带索引）**：页面结构与交互、开发规范（目录结构 / 命名 / 依赖方向）、API 使用规范、本地开发与联调。

根 README 只保留项目介绍、技术选型与启动方式。**易变的细节（页面结构、接口用法）只写在 `docs/`**，不在两处各写一份——复制必然漂移。
