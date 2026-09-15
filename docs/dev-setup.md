# 本地开发与联调

> 面向「把项目跑起来、连上后端、调试某个页面」的实操细节。**最简启动见根 README**。
> 类型生成与契约相关的规则见 [API 使用规范](api-layer.md)。

## 后端地址

- 默认 `http://localhost:8000`，配在 `.env` 的 `VITE_API_BASE_URL`（从 `.env.example` 复制）。
- `VITE_OPENAPI_URL` 可省略：`pnpm gen:api` 会自动取 `${VITE_API_BASE_URL}/openapi.json`。
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

## 调试深层页面

不必每次从启动屏一步步走完：

1. **地址即状态**：游戏页带会话参数，直接改 URL 即可，例如
   `http://localhost:5173/game/webdev/Game1/home`（真实数据，需该 user/game 已存在）。
2. **Mock 模式**：`pnpm dev:mock`，浏览器端 MSW 拦截 API，完全不需要后端。
   - 假数据在 `src/mocks/fixtures.ts`，指定接口的假响应在 `src/mocks/handlers.ts`；
   - 这套 handlers **与单元测试共用**，不会两边漂移；
   - 页面右上角会显示橙色 `MOCK 模式` 徽标，避免误以为在连真实后端。
3. **开发索引**：`/dev` 列出常用深链，点一下就到（例：`http://localhost:5173/dev`）。
