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
12. **SSE 与静态图片不走 openapi-fetch**：SSE 用 `src/api/sse.ts` 的 `streamSseData()`（流式 `fetch` + 手动解析 `data:`，与 TUI 一致）+ `apiUrl()`。**不用原生 `EventSource`**：它无法携带 `Authorization` 头，且自带的重连语义与后端「一次性流」相冲突（详见 `sse.ts` 文件头注释）。

## 二、目录职责

完整的目录结构、组件归属、`.tsx` 位置与依赖方向见 **[conventions.md](conventions.md)**。与 API 直接相关的约束是：

- `src/api/` 只放基础设施与契约适配（`client.ts`、`query.ts`、`types.ts`、`serverInfo.ts`），不放具体业务功能。
- **单接口查询**可直接在页面/组件里用 `$api`，不必包一层。
- **跨接口编排**必须抽成 `src/features/<domain>/` 里的 hook（如 `lobby/useStartGame.ts`），不写在 JSX 里。
- `src/mocks/` 的 handlers / fixtures 由单元测试与 `pnpm dev:mock` **共用**，只维护一处。

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
- handlers 与 fixtures 在 `src/mocks/`，**mock 模式（pnpm dev:mock）与测试共用同一套**，用例内用 `server.use(...)` 覆盖特定接口。
- 用例内用 `server.use(http.get(api("/path"), () => HttpResponse.json(...)))` 注册当次 handler。
- **路径守卫**：`src/mocks/handlers.ts` 的 handler 用的是真实路径字符串，不在 openapi-fetch 的类型检查范围内。`src/mocks/handlers.test.ts` 会把每个 handler 路径与 `pnpm gen:api` 生成的 `src/api/schemaPaths.ts`（契约路径清单）比对，后端改路径而 mock 忘同步时直接报错（参数写法 `{user_name}` / `:userName` 归一后比较）。
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
| SSE（任务） | `src/api/sse.ts` 的 `streamSseData()` + `apiUrl()`（流式 `fetch`）。路径用 `client.ts` 的 `fillPath()` 填充（模板必须是 `keyof paths`，端点写错编译期报错）。目前唯一的 SSE 端点是 `GET /api/tasks/v1/watch/{job_id}`；会话消息走上面的增量轮询 |
| 后端静态图片 | 直接渲染 URL（`apiUrl()` 拼接），不硬编码静态前缀 |
| 任务（job 模式） | 绝大多数动作接口返回 `job_id` 而**非**新状态。**「触发 → 等终态 → 失效刷新」统一用 `src/api/useJobAction.ts`**（它内部用 `src/api/useTask.ts` 经 SSE `GET /api/tasks/v1/watch/{job_id}` 等终态，并把四种失败来源合成一条文案）；各领域只提供「怎么发请求」和「完事失效什么」。**禁止把拿到 `job_id` 当作"操作已完成"。** |
| 任务查询的两种边界 | `job_id` 是整数（OpenAPI 里为 `integer`），非法输入由后端返回 422；未知 id 则推 `{"error":"task_not_found"}` 事件——客户端按连接错误（`streamError`）处理，并保留超时兜底。 |
| **判别字段必须是字符串** | Pydantic 为字面量联合生成的 `discriminator`，其 mapping 的键只能是字符串（JSON 限制），`openapi-typescript` 据此把判别字段渲染成**字符串枚举**。若判别字段实际是整数（`Literal[EventType.SPEAK]`），生成类型会声称 `type: "1"` 而运行时是 `1`——照类型写的 `switch` **全部落到 default，且不报任何错**。<br>这类失真靠自觉发现不了，所以 `scripts/genApi.mjs` 在生成前断言所有判别字段都是 `string`，否则**直接让生成失败**（原先的做法是自动删掉 discriminator，虽能救回类型，却把“契约有异味”这件事悄悄吞了）。后端修法：判别字段用字符串字面量，如 `type: Literal["speak"] = "speak"`。 |
| **`ComponentSerialization.data` 是类型擦除的载荷** | 它是 ECS 组件的**序列化信封**，不是带类型的领域模型：`name` 是组件类名，`data` 是 `Dict[str, Any]`。后端自己反序列化走的就是这套路——`resolve_component_type(name, data)` 拿到类，再 `Cls(**data)` 重建（见 `rpg_entity_manager.py` / `dbg_game.py`）。所以 `data` 在契约里**本来就不该有具体类型**（类型是运行时按 `name` 解析的），这不是缺口，也不应该通过在 API 层加包装类去“修”。<br>客户端对应做法：按 `name` 认出自己关心的组件，再对 `data` 做**运行时逐字段校验**（见 `src/features/blueprint/collectItemContainers.ts`）——这是前端版的 `resolve_component_type`。<br>代价要说清楚：`data` 内部的字段名写错 **TS 拦不住**（它就是 `unknown`），只能靠运行时校验兜住；所以校验失败要掷得下去（返回空），让测试失败而不是静默通过。 |

## 七、后端侧要求（最高杠杆）

前端类型质量完全取决于后端 schema 的具体程度：

1. **每个路由声明 `response_model` / 返回类型**。反例：返回 `Dict[str, Any]` 的路由，只能生成 `{ [key: string]: unknown }`（`/` 就曾如此，现已补上 `ServerInfoResponse`）。
2. **显式声明错误响应**（`responses={400: {"model": ...}}`），否则 `error` 类型信息丢失。
3. **`additionalProperties` 写具体类型**，避免 `Record<string, unknown>`。
4. **保持 snake_case**。
5. Redocly 规则 `operation-operationId-unique`、`operation-parameters-unique`、`path-not-include-query` 设为 error。

前端已启用 `noUncheckedIndexedAccess`（官方推荐），字典取值得到 `T | undefined`。

## 八、生成物版本控制（已决定）

**开发期不提交 `schema.d.ts`**：本机同时开后端，`pnpm gen:api` 始终取最新契约，避免快照漂移。

代价：新克隆需先启动后端才能通过 `pnpm typecheck`。若将来接入 CI，需在 CI 中启动后端生成，或改为「提交生成物 + `gen:api` 后 `git diff --exit-code` 校验」，届时更新本节。
