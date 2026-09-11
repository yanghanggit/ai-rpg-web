# 开发规范

> 本仓库工程约定的**总入口**。API 调用相关规范见 [api-layer.md](api-layer.md)。
> 原则尽量由工具强制（见「五、强制手段」），不靠记忆和眼力。

## 零、总则

1. **无聊但可靠**：优先生态标准方案，不提前引入复杂度（无状态机、无 Next.js、无 WebSocket）。
2. **单一事实源**：类型只来自 `pnpm gen:api` 生成的 `schema.d.ts`；约定只写在本文件，别处引用不复制。
3. **能强制就不靠自觉**：每条规则都要说清"谁保证"（见第五节）。
4. **先定义再遵守**：规则必须可机械判定。含糊的词（"主函数"、"合理的位置"）不算规则。

## 一、目录结构与组件归属

```text
src/api/                 # 基础设施：传输层与契约适配，无业务功能
  schema.d.ts            #   生成物，只读
  client.ts  query.ts  types.ts  serverInfo.ts
src/pages/               # 路由级页面组件（每个 URL 一个）
  LaunchPage.tsx  EntryPage.tsx  HomePage.tsx  DevIndexPage.tsx
src/features/<domain>/   # 领域组件、hook、纯函数
  entry/useStartGame.ts  entry/generatePlayerName.ts  entry/BlueprintDetails.tsx
src/components/          # 通用展示组件（不含领域知识；目前为空，用到再建）
src/mocks/               # mock fixtures / handlers / browser / node（测试与 dev 共用）
src/test/                # 测试基建（setup.ts）
src/App.tsx              # 路由壳
src/main.tsx             # 入口
```

### `.tsx` 只允许出现在这些位置

| 位置 | 放什么 | 判据 |
| --- | --- | --- |
| `src/pages/<Name>Page.tsx` | 路由级页面 | **直接对应一个 URL** |
| `src/features/<domain>/**` | 该领域专用的组件 | 含**领域知识**，且只服务该领域 |
| `src/components/**` | 通用组件 | **不含任何领域知识** |

- 白名单：`src/App.tsx`（路由壳）；`*.test.tsx` 跟随被测模块，位置不限。
- 由 `pnpm check:conventions` 强制。

> 常见误解：`.tsx` ≠ 必须放 `pages/`。**`pages/` 的判据是"有路由"，不是"是组件"。**

### 归属判据：谁变了它才变

组件归属看**变化原因**，不看"当前被谁引用"：

- `BlueprintDetails` 处理 `Blueprint` / `Stage` / `Actor` → **蓝图结构**变它才变 → 属于 `blueprint`，不属于入口流程。
- `useStartGame` 是"登录 → 开局"这个**流程** → **流程**变它才变 → 属于 `entry`。

因此：**只被一个页面用 ≠ 属于那个页面。** 现在放 `entry` 只是因为还没出现第二个使用者（YAGNI）；一旦家园页/dungeon 页也要展示蓝图，就提升到 `src/features/blueprint/`，**不要复制**。

## 二、文件命名

大小写由 Biome 强制；**文件名与导出符号的对应**由 `pnpm check:conventions` 强制。

| 分类 | 规则 | 例 |
| --- | --- | --- |
| 组件 / 页面 `.tsx` | PascalCase，且 `export default` 的组件名 = 文件名 | `LaunchPage.tsx` → `export default function LaunchPage` |
| Hook `.ts`（`use` 开头） | camelCase，且导出同名 hook | `useStartGame.ts` → `export function useStartGame` |
| 其余 `.ts` | camelCase：**只有一个导出且是函数** → 文件名 = 函数名 | `generatePlayerName.ts` → `generatePlayerName` |
| 其余 `.ts` | camelCase：其它情况（多导出，或唯一导出不是函数）→ 概念名 | `client.ts`、`types.ts`、`serverInfo.ts`、`fixtures.ts`、`handlers.ts`；`query.ts`(`$api`)、`mocks/browser.ts`(`worker`)、`mocks/node.ts`(`server`) |
| 测试 | 文件名 = 被测模块名 + `.test` | `generatePlayerName.test.ts`、`App.test.tsx` |
| 无导出文件 | 白名单：`src/main.tsx`、`src/test/setup.ts`；`.d.ts`、`public/mockServiceWorker.js` 不检查 | — |

理由：组件 / hook 的名字对齐是**工具链依赖**（React Fast Refresh 靠文件名推导组件名，hook 靠 `use` 前缀做 lint）；普通模块对齐名字才能让跳转 / 搜索 / fuzzy-find 可预期。

## 三、依赖方向

```text
pages ──┬──▶ features ──┬──▶ components
        │               │
        └───────────────┴──▶ api
```

- 只允许**上层依赖下层**：`api/` 不得 import `features/` 或 `pages/`；`components/` 不得 import `features/` 或 `pages/`。
- **`features/` 之间不互相依赖**。需要共享时：与契约有关 → 下沉 `api/`；纯展示 → 下沉 `components/`；确实是新领域 → 新建 `<domain>`。
- `src/mocks/` 只被测试与 dev 入口引用，**不得进入生产代码**（`main.tsx` 中的引用由 `import.meta.env.DEV` 守卫，生产构建会被 tree-shake）。

## 四、命名之外的硬性约定

- **保留后端 snake_case**，不做 camelCase 转换（详见 [api-layer.md](api-layer.md) 基本原则）。
- **不手写 API 类型**，不 `any`，不在 API 边界 `as`。
- **Provider 只在 `main.tsx` 装配**（`QueryClientProvider`、`BrowserRouter`），页面不自己创建，便于测试用 `MemoryRouter` 替换。

## 五、强制手段（谁保证）

| 规则 | 谁保证 | 命令 |
| --- | --- | --- |
| 类型正确 | `tsc`（strict + `noUncheckedIndexedAccess`） | `pnpm typecheck` |
| 格式 / 大小写 / lint | Biome | `pnpm lint` |
| 文件名 = 导出符号；`.tsx` 位置 | `scripts/checkFileConventions.mjs` | `pnpm lint` / `pnpm check:conventions` |
| API 类型来自生成物 | `pnpm gen:api` + `tsc` | `pnpm gen:api` |
| 行为正确 | Vitest + MSW | `pnpm test:run` |
| 构建可用 | `tsc --noEmit && vite build` | `pnpm build` |

新增规则时，**先想清楚它属于哪一行**；无法被工具强制的，要在此表注明"靠 review"。
