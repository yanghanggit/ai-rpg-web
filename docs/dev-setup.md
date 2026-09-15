# 本地开发与联调

> 面向「把项目跑起来、连上后端、调试某个页面」的实操细节。**最简启动见根 README**。
> 类型生成与契约相关的规则见 [API 使用规范](api-layer.md)。

## 端口

| 用途 | 端口 | 改了会不会自动生效 |
| ------ | ------ | ------ |
| `pnpm dev`（连真实后端） | 5173 | 改 `scripts/devPorts.mjs` 的 `DEV_PORT` |
| `pnpm dev:mock`（MSW 假数据） | 5273 | 同上，改 `MOCK_PORT` |
| 后端（FastAPI） | 8000 | 改 `.env` 的 `VITE_API_BASE_URL` |

前两个数字**只写在 `scripts/devPorts.mjs`**，`vite.config.ts` 与 `scripts/screenshot.mjs` 都从它引入；`pnpm lint`（`scripts/checkDevPorts.mjs`）会检查别处没有再写死，**注释里也不行**。后端地址不属于这个体系：它由 `.env` 决定（见下一节）。

两个模式用**不同**端口是刻意的：可以同时开着真数据与假数据对比，而不是一件事两个名字。

- **端口被占用会直接启动失败**（`strictPort`），不会静默顺延。这不是待修的体验问题，是设计如此：
  人与 agent 都要能对「现在跑的是哪个 server」有确定答案。处理方式只有两种，都显式：
  1. **关掉占用者**：`lsof -nP -i :5173`（往往是自己上次没关的 dev server）；
  2. **换端口跑**：临时 `pnpm dev --port 5180`；要永久换就改 `scripts/devPorts.mjs`——只改这一处，守卫会保证别处没有漏改的字面量。
- 为什么不自动顺延：那样「5173」就成了一句谎话——脚本默认值、深链、文档示例都会指向另一台服务器
  （很可能是别人连着真实后端的那个），**而截图与请求看起来一切正常**。

## 后端地址

两个地址都在 `.env` 里，各自维护：

- `VITE_API_BASE_URL`：后端地址，默认 `http://localhost:8000`（从 `.env.example` 复制）。页面与认证都走它。
- `VITE_OPENAPI_URL`：仅当 OpenAPI 与后端不同源时才需要设置。不设时 `pnpm gen:api` 会取 `${VITE_API_BASE_URL}/openapi.json`。
- **改 `.env` 必须重启 dev server**：Vite 只在启动时读取环境变量，热更新不生效。改完顺手 `pnpm gen:api`，让生成的类型也跟随新地址。

## 局域网 / 真机访问（用明确 IP，不用 localhost）

适用场景：后端监听 `0.0.0.0`，希望用本机网卡 IP 访问，或让手机 / 其他设备访问本前端。

### 1. 查本机网卡 IP

```bash
# macOS
ifconfig en0 | grep "inet "

# Linux
ip addr show
```

留意可能有多个网卡（如 VPN 的 `utun*`），选真实局域网那张（通常是 `en0`，形如 `192.168.x.x`）。

### 2. 把后端地址改成本机 IP（`.env`，不要用 `localhost`）

```dotenv
VITE_API_BASE_URL=http://192.168.22.235:8000
```

### 3. 重启开发服务器

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

### 4. 验证

```bash
curl -I http://192.168.22.235:8000/     # 后端可达
```

### 注意事项

- 后端必须监听 `0.0.0.0`（仅 `127.0.0.1` 时局域网 IP 连不上）。
- 前端 dev server 已在 `vite.config.ts` 设置 `server.host: true`，无需额外参数。
- 首次从其他设备访问若被系统防火墙拦截，需在系统设置中放行 Node / Vite 的入站连接。
- IP 由 DHCP 分配可能变化，变了要同步改 `.env`；建议在路由器上做 MAC 绑定。
- 后端 CORS 已是 `allow_origins=["*"]`，换 IP 不会触发跨域问题。

## UI 截图（视觉核对）

响应式排法没有 CSS 断言，只能看：`pnpm screenshot` 会用真实的 headless Chrome 拍一张，
能指定视口、还能**先点几下再拍**（浮窗、二级浮窗这类只有点开才看得到）。

```bash
# 桌面默认（1280x900），输出 screenshots/dungeon-1280x900.png
pnpm screenshot /game/webdev/Game1/dungeon

# 手机视口 + 点开确认浮窗
pnpm screenshot /game/webdev/Game1/dungeon --size 390x844 --click "进入副本：荒村义庄"

# mock 模式（pnpm dev:mock 固定跑在自己的端口，不必再手填 --base）
pnpm screenshot /game/webdev/Game1/dungeon --mock
```

`--click` 按 `aria-label` 或按钮文字匹配，用 `|` 分隔可连点；写错了会直接把当前页面上的按钮全列出来。
完整选项见 `pnpm screenshot --help`。输出默认落在 `screenshots/`（已 gitignore）。

两个容易踩的坑，脚本已经处理：

- **不要用 `chrome --headless --screenshot`**：它在 load 事件就落笔，而首屏要等 React 挂载、mock 模式还要等 MSW 的 service worker 接管，拍出来是**空白页**（`--virtual-time-budget` 在 headless=new 下也救不回来）。
- **不要用 `--window-size` 定视口**：headless 下有最小宽度，想验 390px 会被悄悄放大，也就验不出横向溢出。脚本走 CDP 的 `Emulation.setDeviceMetricsOverride`。

## 调试深层页面

不必每次从启动屏一步步走完：

1. **地址即状态**：游戏页带会话参数，直接改 URL 即可，例如
   `http://localhost:5173/game/webdev/Game1/home`（真实数据，需该 user/game 已存在）。
2. **Mock 模式**：`pnpm dev:mock`，浏览器端 MSW 拦截 API，完全不需要后端。
   - 假数据在 `src/mocks/fixtures.ts`，指定接口的假响应在 `src/mocks/handlers.ts`；
   - 这套 handlers **与单元测试共用**，不会两边漂移；
   - 页面右上角会显示橙色 `MOCK 模式` 徽标，避免误以为在连真实后端。
3. **开发索引**：`/dev` 列出常用深链，点一下就到（例：`http://localhost:5173/dev`）。
