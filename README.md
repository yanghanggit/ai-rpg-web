# ai-rpg-web

AI-RPG 的 Web 客户端（面向玩家），与后端仓库 `ai-rpg` 完全独立。

技术栈：React + Vite + TypeScript（strict）+ TanStack Query + Biome + Vitest。

## 快速开始

```bash
pnpm install
cp .env.example .env        # 按需修改后端地址
pnpm dev
```

后端默认地址 `http://localhost:8000`（见 `.env`）。

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

- 所有请求走 `src/api/client.ts`，类型优先使用 `pnpm gen:api` 生成的 `src/api/schema.d.ts`（已 gitignore，按需重新生成）。
- 后端契约见 `ai-rpg` 仓库的 `docs/web-client-plan.md`。
