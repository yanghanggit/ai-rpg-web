# ai-rpg-web

AI-RPG 的 Web 客户端（面向玩家），与后端仓库 `ai-rpg` 完全独立。

技术栈：React + Vite + TypeScript（strict）+ React Router + TanStack Query + openapi-fetch / openapi-react-query + Biome + Vitest + MSW。

## 页面结构

| 路由 | 页面 | 职责 |
| ------ | ------ | ------ |
| `/` | `src/pages/LaunchPage.tsx` | 启动屏：展示服务器地址与连接状态，与玩家身份无关 |
| `/entry` | `src/pages/EntryPage.tsx` | 玩家入口：玩家名自动生成（带日期），游戏名从 `/api/game/blueprint-list/v1/` 蓝图列表选择，并展示所选蓝图详情（玩家角色 / 战役设定 / 场景-角色映射 / 世界实体），登录 → 新游戏 |
| `/game/:userName/:gameName/home` | `src/pages/HomeOverviewPage.tsx` | 家园概览：只有**功能按钮**与**场景卡片**两块。按钮条：`推进一步 · N 个角色`（人数直接写在按钮上）、`角色信息`（点击弹出玩家控制角色的信息浮窗）、`蓝图信息`（点击弹出蓝图名字/战役设定/世界系统）、`道具管理`（点击弹出背包与储物箱道具；储物箱顶部为穿戴中的时装，只读；勾选道具后可与「移入背包」平级地合成消耗品/制造装备/制作时装，点开会叠出确认用量的浮窗）、`叙事 已看/总共`（右边大于左边即有新事件未看，点击弹出「全部叙事」浮层）、`← 返回上一级`（浮窗确认后登出）。卡片：每个 stage 一张，列出其中的 actor，底部有「切换到此场景」按钮；玩家当前所在卡片高亮并标记「当前所在」 |
| `/dev` | `src/pages/DevIndexPage.tsx` | 开发索引（仅 dev 注册）：常用深链清单 |

- 路由表在 `src/App.tsx`；Provider（`QueryClientProvider`、`BrowserRouter`）在 `src/main.tsx` 装配。
- **游戏页一律带会话参数**（`/game/:userName/:gameName/...`），即“地址即状态”——可直接深链到任意一层。
- 领域逻辑与跨接口编排放 `src/features/<domain>/`；组件放哪、依赖方向见 [`docs/conventions.md`](docs/conventions.md)。

## 快速开始

```bash
pnpm install
cp .env.example .env        # 按需修改后端地址
pnpm dev
```

后端默认地址 `http://localhost:8000`（见 `.env`）。`pnpm dev` 监听 `0.0.0.0`，终端会打印 Network 地址，局域网内其他设备可直接访问。

### 局域网开发（用明确 IP，不用 localhost）

适用场景：后端监听 `0.0.0.0`，希望用本机网卡 IP 访问，或让手机/其他设备访问本前端。

#### **1. 查本机网卡 IP**

```bash
# macOS
ifconfig en0 | grep "inet "

# Linux
ip addr show
```

留意可能有多个网卡（如 VPN 的 `utun*`），选真实局域网那张（通常是 `en0`，形如 `192.168.x.x`）。

#### **2. 把后端地址改成本机 IP**（`.env`，不要用 `localhost`）

```dotenv
VITE_API_BASE_URL=http://192.168.22.235:8000
```

`VITE_OPENAPI_URL` 可省略，`pnpm gen:api` 会自动取 `${VITE_API_BASE_URL}/openapi.json`。

#### **3. 重启开发服务器**（Vite 仅在启动时读取环境变量，改 `.env` 后热更新不生效）

```bash
pnpm gen:api    # 让类型也跟随新地址生成
pnpm dev
```

终端会同时打印 Local 与 Network 地址，局域网内其他设备用 `en0` 那条：

```text
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.22.235:5173/  en0
➜  Network: http://198.18.194.71:5173/   utun4
```

#### **4. 验证**

```bash
curl -I http://192.168.22.235:8000/     # 后端可达
```

注意事项：

- 后端必须监听 `0.0.0.0`（仅 `127.0.0.1` 时局域网 IP 连不上）。
- 前端 dev server 已在 `vite.config.ts` 设置 `server.host: true`，无需额外参数。
- 首次从其他设备访问若被系统防火墙拦截，需在系统设置中放行 Node/Vite 的入站连接。
- IP 由 DHCP 分配可能变化，变了要同步改 `.env`；建议在路由器上做 MAC 绑定。
- 后端 CORS 已是 `allow_origins=["*"]`，换 IP 不会触发跨域问题。

## 调试与 Mock 模式

调试深层页面不必每次从启动屏一步步走完：

1. **地址即状态**：游戏页带会话参数，直接改 URL 即可，例如
   `http://localhost:5173/game/webdev/Game1/home`（真实数据，需该 user/game 已存在）。
2. **Mock 模式**：`pnpm dev:mock`，浏览器端 MSW 拦截 API，完全不需要后端。
   - 假数据在 `src/mocks/fixtures.ts`，指定接口的假响应在 `src/mocks/handlers.ts`；
   - 这套 handlers **与单元测试共用**，不会两边漂移；
   - 页面右上角会显示橙色 `MOCK 模式` 徽标，避免误以为在连真实后端。
3. **开发索引**：`/dev` 列出常用深链，点一下就到（例：`http://localhost:5173/dev`）。

## 常用命令

| 命令 | 说明 |
| ------ | ------ |
| `pnpm dev` | 启动开发服务器（连真实后端） |
| `pnpm dev:mock` | 启动开发服务器 + 浏览器端 MSW，用 `src/mocks/fixtures.ts` 假数据调试页面 |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm preview` | 预览构建产物 |
| `pnpm gen:api` | 从后端 `/openapi.json` 生成 TS 类型到 `src/api/schema.d.ts`（需后端已启动） |
| `pnpm format` | Biome 格式化 |
| `pnpm lint` / `pnpm lint:fix` | Biome 静态检查（含文件命名校验）/ 自动修复 |
| `pnpm check:conventions` | 单独跑文件命名校验（已包含在 `pnpm lint`） |
| `pnpm typecheck` | TypeScript 严格类型检查 |
| `pnpm test` / `pnpm test:run` | Vitest 测试（watch / 单次） |

## 约定

- **开发规范（命名 / 目录结构 / 组件归属 / 依赖方向）见 [`docs/conventions.md`](docs/conventions.md)**，由 `pnpm lint`（Biome + `check:conventions`）强制。
- **API 使用规范见 [`docs/api-layer.md`](docs/api-layer.md)（先读「基本原则」）。**
- 核心：类型来自 `pnpm gen:api` 生成的 `src/api/schema.d.ts`（已 gitignore，开发期不提交）；不手写 API 类型；REST 走 `src/api/client.ts`（openapi-fetch），查询用 `src/api/query.ts` 的 `$api`。
- 测试用 MSW：handlers / fixtures 在 `src/mocks/`，与 `pnpm dev:mock` 共用；未注册 handler 的请求会让测试失败。
- 后端契约见 `ai-rpg` 仓库的 `docs/web-client-plan.md`。

## 最短的"检查 + 构建 + 启动"三连

```bash
pnpm install && pnpm gen:api && pnpm typecheck && pnpm lint && pnpm test:run && pnpm build && pnpm dev 
```
