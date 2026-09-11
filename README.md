# ai-rpg-web

AI-RPG 的 Web 客户端（面向玩家），与后端仓库 `ai-rpg` 完全独立。

技术栈：React + Vite + TypeScript（strict）+ TanStack Query + openapi-fetch / openapi-react-query + Biome + Vitest。

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

## 常用命令

| 命令 | 说明 |
| ------ | ------ |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm preview` | 预览构建产物 |
| `pnpm gen:api` | 从后端 `/openapi.json` 生成 TS 类型到 `src/api/schema.d.ts`（需后端已启动） |
| `pnpm format` | Biome 格式化 |
| `pnpm lint` / `pnpm lint:fix` | Biome 静态检查 / 自动修复 |
| `pnpm typecheck` | TypeScript 严格类型检查 |
| `pnpm test` / `pnpm test:run` | Vitest 测试（watch / 单次） |

## 约定

- **API 使用有强制规范，见 [`docs/api-layer.md`](docs/api-layer.md)（先读「基本原则」）。**
- 核心：类型来自 `pnpm gen:api` 生成的 `src/api/schema.d.ts`（已 gitignore，开发期不提交）；不手写 API 类型；REST 走 `src/api/client.ts`（openapi-fetch），查询用 `src/api/query.ts` 的 `$api`。
- 测试用 MSW（`src/test/`），未注册 handler 的请求会让测试失败。
- 后端契约见 `ai-rpg` 仓库的 `docs/web-client-plan.md`。

## 最短的"检查 + 构建 + 启动"三连

```bash
pnpm install && pnpm gen:api && pnpm typecheck && pnpm lint && pnpm test:run && pnpm build && pnpm dev 
```
