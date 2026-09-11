# API 使用规范与实践

> 本项目所有前端代码消费后端 `ai-rpg`（FastAPI）的方式以此文为准。
> 新增功能前先读「基本原则」，它是强制约定。

## 一、基本原则（强制）

1. **单一事实源**：`src/api/schema.d.ts` 由 `openapi-typescript` 从后端 `/openapi.json` 生成。**禁止手改、禁止提交**（开发期），后端模型变更后必须 `pnpm gen:api` 再 `pnpm typecheck`。
2. **禁止手写 API 类型**。请求/响应/参数类型一律从生成物派生，不得在业务代码里重复定义接口。
3. **禁止直接使用 `fetch`**。所有 REST 请求走 `src/api/client.ts` 的 `client`（openapi-fetch）；是否新增 HTTP 库需先改本文。
4. **查询/变更统一用 `$api`**（openapi-react-query）。`queryKey` 固定为 `[method, path, params]`，失效操作用 `$api.queryOptions(...)`，不要手写 queryKey 字符串。
5. **跨接口编排用原生 `useMutation` + `client.POST`**，并抽成 hook（如 `useStartGame`），不要把多步请求裸写在 JSX 组件里。
6. **错误必须显式处理**。要么解构 `{ data, error }` 判断，要么用 `unwrap()` 抛 `ApiError`；UI 必须有 error 分支，禁止吞掉错误。
7. **禁止 `any`，禁止在 API 边界用 `as`**。需要显式命名类型时用 `Schemas["X"]` 或 `ApiResponse<path, method>`（`src/api/types.ts`）。
8. **保留后端字段的 snake_case**，不做 camelCase 转换（官方 styleguide 明确建议）。
9. **认证只在 middleware 注入**。业务代码不碰 `Authorization` 头。
10. **契约缺口单独隔离**。后端缺 `response_model` 时，在独立文件做收窄 + 运行时校验并标注 TODO 请后端补齐，不得在业务代码里强转。
11. **测试用 MSW**，不 mock 整个 client 模块；未注册 handler 的请求直接让测试失败（`onUnhandledRequest: "error"`）。
12. **SSE 与静态图片不走 openapi-fetch**，用 `EventSource` + `apiUrl()`；SSE 必须处理断线重连与事件序号去重。

## 二、目录职责

```text
src/api/                 # 基础设施
  schema.d.ts            # 生成物，只读
  client.ts              # 传输层：openapi-fetch 客户端、middleware、unwrap、apiUrl
  query.ts               # $api = openapi-react-query
  types.ts               # 需要命名时使用的派生类型
  serverInfo.ts         # 唯一一处契约缺口收窄（/ 缺 response_model）
src/pages/               # 路由级页面组件（薄，负责组合）
  LaunchPage.tsx         # 启动屏 /
src/features/<domain>/   # 领域逻辑：编排 hook、纯函数、子组件
  entry/useStartGame.ts  # 登录 → 新游戏编排
  entry/playerName.ts    # 玩家名生成（纯函数）
  entry/BlueprintDetails.tsx  # 蓝图详情展示组件
src/test/                # MSW 与测试基建
```

- `src/api/` 只放基础设施与跨领域的契约适配，不放具体业务功能。
- 页面组件放 `src/pages/`（命名 `<Name>Page.tsx`），在 `src/App.tsx` 的路由表里注册；页面保持“薄”，只做组合与展示。
- 领域逻辑与跨接口编排放 `src/features/<domain>/`（如 `entry`、`home`、`dungeon`、`combat`）。单接口查询可直接在页面里用 `$api`，不必包一层。
- 路由用 react-router 声明式模式。Provider（`QueryClientProvider`、`BrowserRouter`）只在 `main.tsx` 装配，页面不自己创建；测试用 `MemoryRouter` 替换。

## 三、工具链

| 角色 | 工具 | 说明 |
| ------ | ------ | ------ |
| 类型生成 | `openapi-typescript` | `pnpm gen:api` 生成 `schema.d.ts` |
| 类型安全请求 | `openapi-fetch` | `client.GET/POST`，方法/路径/参数/body/响应全自动推导 |
| 类型安全查询 | `openapi-react-query` | `$api.useQuery/useMutation/queryOptions` |

## 四、使用范式

### 查询（GET）

```tsx
const state = $api.useQuery("get", "/api/stages/v1/{user_name}/{game_name}/state", {
  params: { path: { user_name, game_name } },
});
// state.data / state.error 均为后端类型；路径或参数写错编译期报错
```

按资源整体失效：

```ts
queryClient.invalidateQueries($api.queryOptions("get", "/api/home/dungeon-list/v1/"));
```

### 单接口变更（POST）

```tsx
const advance = $api.useMutation("post", "/api/home/advance/v1/", {
  onSuccess: () => queryClient.invalidateQueries(...),
});
advance.mutate({ body: { user_name, game_name, actors } });
```

### 跨接口编排

```ts
// src/features/onboarding/useStartGame.ts
export function useStartGame() {
  return useMutation({
    mutationFn: async ({ user_name, game_name }: { user_name: string; game_name: string }) => {
      const body = { user_name, game_name };
      unwrap(await client.POST("/api/login/v1/", { body }));
      return unwrap(await client.POST("/api/game/new/v1/", { body }));
    },
  });
}
```

### 错误处理

`openapi-fetch` 返回 `{ data, error, response }` 判别联合：`data` 仅 2xx 存在，`error` 仅非 2xx 存在，且 `error` 的类型来自 schema 中**声明的**错误响应。需要抛异常时统一用 `unwrap()`，得到带 `status` 与结构化 `body` 的 `ApiError`。

### 认证

```ts
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = localStorage.getItem("ai-rpg-token");
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
};
```

JWT 后端已预留，接入时只需登录后写入 token。

## 五、测试（MSW）

- `src/test/setup.ts` 统一 `listen / resetHandlers / close`，`onUnhandledRequest: "error"`。
- 用例内用 `server.use(http.get(api("/path"), () => HttpResponse.json(...)))` 注册当次 handler。
- 断言请求体：在 handler 里 `await request.json()` 收集后断言。
- 测试真实走 `globalThis.fetch`，因此客户端必须**延迟解析** `globalThis.fetch`（`client.ts` 已处理）。

```ts
server.use(
  http.post(api("/api/login/v1/"), async ({ request }) => {
    expect(await request.json()).toEqual({ user_name: "tester", game_name: "demo" });
    return HttpResponse.json({ message: "ok" });
  }),
);
```

## 六、OpenAPI 覆盖不到的边界

| 场景 | 处理 |
| ------ | ------ |
| SSE（会话消息、后台任务） | `EventSource` / 流式 `fetch` + `apiUrl()`；处理重连与序号去重 |
| 后端静态图片 | 直接渲染 URL（`apiUrl()` 拼接），不硬编码静态前缀 |

## 七、后端侧要求（最高杠杆）

前端类型质量完全取决于后端 schema 的具体程度：

1. **每个路由声明 `response_model` / 返回类型**。反例：`/` 返回 `Dict[str, Any]`，只能生成 `{ [key: string]: unknown }`。
2. **显式声明错误响应**（`responses={400: {"model": ...}}`），否则 `error` 类型信息丢失。
3. **`additionalProperties` 写具体类型**，避免 `Record<string, unknown>`。
4. **保持 snake_case**。
5. Redocly 规则 `operation-operationId-unique`、`operation-parameters-unique`、`path-not-include-query` 设为 error。

前端已启用 `noUncheckedIndexedAccess`（官方推荐），字典取值得到 `T | undefined`。

## 八、生成物版本控制（已决定）

**开发期不提交 `schema.d.ts`**：本机同时开后端，`pnpm gen:api` 始终取最新契约，避免快照漂移。

代价：新克隆需先启动后端才能通过 `pnpm typecheck`。若将来接入 CI，需在 CI 中启动后端生成，或改为「提交生成物 + `gen:api` 后 `git diff --exit-code` 校验」，届时更新本节。
