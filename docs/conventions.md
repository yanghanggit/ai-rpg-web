# 开发规范

> 本仓库工程约定的**总入口**。API 调用相关规范见 [api-layer.md](api-layer.md)。
> 原则尽量由工具强制（见「五、强制手段」），不靠记忆和眼力。

## 零、总则

1. **无聊但可靠**：优先生态标准方案，不提前引入复杂度（无状态机、无 Next.js、无 WebSocket）。
2. **单一事实源**：类型只来自 `pnpm gen:api` 生成的 `schema.d.ts`；约定只写在本文件，别处引用不复制。
3. **能强制就不靠自觉**：每条规则都要说清"谁保证"（见第五节）。
4. **先定义再遵守**：规则必须可机械判定。含糊的词（"主函数"、"合理的位置"）不算规则。
5. **让执行傻，让流程聪明**：节点（函数 / 接口 / 脚本）要简单、坚固、**不做判断**；编排与判断集中在上一层（hook / 页面 / 维护者 / agent）。
   - 这已经是本仓库的骨架：动作接口只返回 `job_id`、**不**判断"做完没有"，由 `useTask` + 失效刷新这套流程决定何时算完成；`displayName`、`readItems` / `ItemRow`、`devPorts.mjs` 都只做一件事，规则写在文档与测试里。
   - 推论：**不做「无感智能兼容」**——起不来就明确失败（`strictPort`），不静默降级、不自动兜底、不猜意图；宁可让人 / agent 读一遍报错再显式改一次。
   - 例：dev 端口被占 → 直接失败，换端口是显式决定；截图脚本找不到按钮 → 列出当前所有按钮并失败，而不是拍一张"差不多"的图。
   - 代价要说清：傻节点**不会自我纠错**，所以判断必须真的放在上一层，靠测试与守卫脚本（`checkFileConventions` / `checkDevPorts`）兜住，而不是让节点顺手兼容一下。
   - 判据：一处「聪明」若让错误消失得无影无踪，就不该做；顺手兼容往往是以后花半天排查的捷径。

## 一、目录结构与组件归属

```text
src/api/                 # 基础设施：传输层与契约适配，无业务功能
  schema.d.ts            #   生成物，只读
  client.ts  query.ts  types.ts  serverInfo.ts  sse.ts  useTask.ts  useJobAction.ts  describeApiError.ts
src/pages/               # 路由级页面组件（每个 URL 一个）
  LaunchPage.tsx  EntryPage.tsx  HomeOverviewPage.tsx  DungeonOverviewPage.tsx  DungeonRoomPage.tsx  DevIndexPage.tsx
src/features/<domain>/   # 领域组件、hook、纯函数
  entry/useStartGame.ts  entry/generatePlayerName.ts
  blueprint/BlueprintDetails.tsx  blueprint/BlueprintInfoDialog.tsx  blueprint/useBlueprint.ts
  home/useSwitchStage.ts  home/findStageOfActor.ts  home/EntityBrowserDialog.tsx
  identity/ActorInfoDialog.tsx  identity/readActorInfo.ts  identity/useActorEntity.ts  identity/usePlayerActor.ts
  costume/StorageCostumeDialog.tsx  costume/useStorageCostumes.ts  costume/useCostumeAction.ts
  stage/StageInfoDialog.tsx  stage/readStageInfo.ts  stage/useStageEntity.ts
  dungeon/RosterPanel.tsx  dungeon/readPartyRoster.ts  dungeon/usePartyRoster.ts  dungeon/useRosterCandidates.ts  dungeon/useRosterAction.ts
  dungeon/DungeonPanel.tsx  dungeon/DungeonInfoDialog.tsx  dungeon/readDungeonInfo.ts  dungeon/useDungeonList.ts  dungeon/useGenerateDungeon.ts  dungeon/invalidateDungeons.ts
  dungeon/useDungeonRoom.ts  dungeon/useDungeonRun.ts  dungeon/useExitDungeon.ts  dungeon/useAdvanceStage.ts
  dungeon/OpeningRoomPanel.tsx  dungeon/useOpeningParty.ts  dungeon/useOpeningActions.ts  dungeon/DeckDialog.tsx  dungeon/SpoilsDialog.tsx  dungeon/AdvanceRoomDialog.tsx
  entities/invalidateEntities.ts
  cards/CardItem.tsx  cards/readCard.ts  cards/readCards.ts  cards/types.ts
  items/ItemManagerDialog.tsx  items/CraftConfirmDialog.tsx  items/useItemContainers.ts  items/useMoveItem.ts  items/useCraftItem.ts
  session/useSessionMessages.ts  session/NarrativeButton.tsx  session/NarrativeOverlay.tsx
  session/sessionKey.ts  session/unreadBaselines.ts  session/useUnreadCount.ts
src/components/          # 通用展示逻辑（不含领域知识）
  displayName.ts         #   服务器名字 → 显示名，名字显示的唯一规则入口
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
- **唯一的例外：道具。** `features/items` 是「一件道具长什么样」的唯一实现——**解析**（`readItems` + `Item`）与**展示**（`ItemRow`，含名字 `×N`、中文类型 chip）都在那里，其它领域直接复用（现有使用者：`costume` 的穿/脱、`dungeon` 的出征点验），**不得另行解析、也不得另写一种样式**。理由：读 `ComponentSerialization.data` 是运行时逐字段校验，复制第二份等于把「字段名写错」的机会翻倍；展示分叉则会让同一种道具在两个浮窗里长得不一样。而且这是**单向**依赖（items 不反向依赖任何领域），不形成环。
- **第二个共享基础领域：实体 / 组件。** `features/entities` 是「实体与组件载荷怎么读」的唯一实现——通用访问（`ecs.ts`：`getComponent` / `hasComponent` / 字段读取 `readString|readNumber|readBoolean`）与跨领域共用的类型化读取器（`readCharacterStats`）都集中在那里；查询失效口径（`invalidateEntities.ts`）也已在此。其它领域直接复用（现有使用者：`identity` / `stage` / `dungeon` / `cards` / `items` / `blueprint` / `costume` / `home`），**不得各自再写 `isRecord` / `findComponent` / `readStats`**。理由同上：`ComponentSerialization.data` 是 `Dict[str, Any]`，逐字段校验的副本越多，字段名写错的机会越多。依赖同样是**单向**的（entities 不反向依赖任何领域），不形成环。领域专属的组件读取器（手牌 / 牌堆 / 时装…）仍留在各自领域，不进 `ecs.ts`。
- `src/mocks/` 只被测试与 dev 入口引用，**不得进入生产代码**（`main.tsx` 中的引用由 `import.meta.env.DEV` 守卫，生产构建会被 tree-shake）。

## 四、命名之外的硬性约定

- **保留后端 snake_case**，不做 camelCase 转换（详见 [api-layer.md](api-layer.md) 基本原则）。
- **不手写 API 类型**，不 `any`，不在 API 边界 `as`。
- **服务器名字一律经 `displayName` 显示**（`src/components/displayName.ts`）：只保留最后一段，`角色.无名` → `无名`。**取身份的地方一律用原始名字**——比较、URL、API 参数、React key 都用原值（显示名会撞：`角色.无名` / `怪物.无名`）。要改"名字怎么显示"只改这一个函数，不在组件里各写一份。
- **Provider 只在 `main.tsx` 装配**（`QueryClientProvider`、`BrowserRouter`），页面不自己创建，便于测试用 `MemoryRouter` 替换。
- **端口只有一个来源**：dev / mock 端口写在 `scripts/devPorts.mjs`，别处一律 import（`vite.config.ts`、`scripts/screenshot.mjs`）；注释里也不写数字，具体端口见 [dev-setup.md](dev-setup.md)。由 `pnpm lint` 强制。

## 五、布局与响应式（只做桌面）

**本项目只保证桌面网页**，手机 / 平板（无论横竖屏）不做兼容，也不加「请横屏使用」门槛。

- **最小支持宽度 = 1024px，唯一基线。** 这是本节所有断点的取值来源：媒体查询统一用 `@media (min-width: 1024px)`，不要出现别的断点数字。比 1024px 更窄的视口只保证「不横向溢出」，不保证排法好看。
- 页面外层统一用 `.page`（窄栏、居中，宽屏不铺满）。需要横向空间的页面加 `.page--wide`，它在 `@media (min-width: 1024px)` 放宽到 1180px。
- 多列一律交给 CSS Grid：`repeat(auto-fill, minmax(min(Npx, 100%), 1fr))`。`min(Npx, 100%)` 是**防横向溢出**的兜底（与手机兼容无关，任何宽度都保留），列数随可用宽度自动变化。**不要写固定列数**。
- 需要桌面多列时用网格容器（如 `.entry-layout`、`.link-grid`），不要把内容写两遍。
- 文字类页面保持窄栏（控制可读行长）；长值（URL、UUID）用 `overflow-wrap: anywhere` 防溢出。

新增页面默认 `.page`；只有确实需要更多横向空间才加 `.page--wide`，并给出桌面多列排法。

**为什么不做手机**：手机横屏的可用宽度只有 667–932px、可用高度只有 ~390px，要好看必须按「短边」而不是「宽度」重排，并逐页压缩到一屏内，成本远高于桌面收益。若将来要加回来，入口是**门槛（竖屏提示）+ 按短边重排**这一整套，而不是调大 / 调小断点。

## 六、交互基调：游戏客户端，输入控件要克制

这是**游戏客户端**，不是表单系统。页面应该「像游戏一样可点」，所以设计准则是**尽量不用需要用户输入的控件**：

- 能用点击解决的，就不要让用户打字。选择 / 切换 / 增删一律用按钮、chip、列表项完成。
- **不要用「搜索框 / 筛选框 / 文本框」去解决集合变长的问题**。让规模由**布局**消化：优先**卡片栅格**（一格一条、一行多张、自动换行），数量确实很大时再叠加**限高滚动**或分组。
- 新增输入控件必须单独说明理由（属于「必须让用户给一个值」的情形），并在 review 时确认没有别的点选方案。

现有**需要用户给值**的输入控件仅两处，均为不可替代的“给值”，不是自由输入：

- 入口页的蓝图 `<select>`：取值范围由服务器决定（契约约束），不能让用户手填。
- 合成浮窗的材料用量 `<input type="number">`：需要具体份数，且已默认填满库存。

其余 `<input>` 只有道具勾选用的 `type="checkbox"`——那是“点选”，符合上面的准则。

## 七、强制手段（谁保证）

| 规则 | 谁保证 | 命令 |
| --- | --- | --- |
| 类型正确 | `tsc`（strict + `noUncheckedIndexedAccess`） | `pnpm typecheck` |
| 格式 / 大小写 / lint | Biome | `pnpm lint` |
| 文件名 = 导出符号；`.tsx` 位置 | `scripts/checkFileConventions.mjs` | `pnpm lint` / `pnpm check:conventions` |
| dev 端口字面量只出现在 `scripts/devPorts.mjs` | `scripts/checkDevPorts.mjs` | `pnpm lint` / `pnpm check:ports` |
| API 类型来自生成物 | `pnpm gen:api` + `tsc` | `pnpm gen:api` |
| 名字显示统一走 `displayName` | 靠 review（无工具可强制） | — |
| 桌面排法（最小支持宽度 1024px） | 靠 review（CSS 无断言），可用 `pnpm screenshot` 拍图核对 | — |
| 不滥用输入控件（游戏客户端） | 靠 review（无工具可强制） | — |
| 不做无感智能兼容（起不来就失败） | 靠 review（无工具可强制） | — |
| 行为正确 | Vitest + MSW | `pnpm test:run` |
| 构建可用 | `tsc --noEmit && vite build` | `pnpm build` |

新增规则时，**先想清楚它属于哪一行**；无法被工具强制的，要在此表注明"靠 review"。
