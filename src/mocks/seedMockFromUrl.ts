/**
 * dev/mock 专用的「深链种子」：把 URL 上的 `?seed=...` 翻译成一份 mock 初始状态。
 *
 * 目的是让 `DevIndexPage` 能直接深链到**任意战斗阶段**（`/dungeon/room?seed=combat:turn`），
 * 不必每次手动「进入副本 → 进入下一关」。它守住既定原则：
 * - **不给 phase 加路由**：路径仍是 `/dungeon/room`，`seed` 只是 mock 指令；
 * - **app / router 零感知**：只有 dev 入口（`main.tsx::enableMocking`）调用它；
 * - **与测试同源**：造状态调的就是测试用的那几个 mock 函数，不引入第二套真值来源。
 *
 * 「表达状态」用**阶段名**（`combat:turn`）而不是原始字段（`state=2`）：前者是意图，后者是实现细节。
 */
import { drawMockCards, initMockCombat, prepareMockPostCombat } from "./combat";
import { advanceMockDungeon, enterMockDungeon } from "./dungeons";

/** 种子只服务 fixture 里那份副本；将来要种别的副本，再把副本名并进 token。 */
const DUNGEON = "副本.荒村义庄";

/** token → 「造出该阶段」的一串 mock 调用（每个 token 覆盖一个 `deriveCombatPhase` 分支）。 */
const SEEDS: Record<string, () => void> = {
  // INITIALIZATION：刚推进到战斗房间，等待初始化
  "combat:init": () => {
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
  },
  // ONGOING 且无回合：等待「抓牌 / 开启新回合」
  "combat:round_start": () => {
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    initMockCombat();
  },
  // ONGOING 且回合已抓牌：轮到某个角色行动
  "combat:turn": () => {
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    initMockCombat();
    drawMockCards();
  },
  // POST_COMBAT：结算态（胜利 + 战利品 + 怪物战死）
  "combat:post": () => {
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    prepareMockPostCombat();
  },
};

/**
 * 读出 URL 上的 `seed` 并执行对应造状态；没有 `seed` 或 token 未知时**什么都不做**
 * （不抛异常，避免 dev 页面因为手输错一个词就白屏）。
 */
export function seedMockFromUrl(url: string = window.location.href): void {
  const token = new URL(url).searchParams.get("seed");
  if (token === null) {
    return;
  }
  const setup = SEEDS[token];
  if (setup === undefined) {
    console.warn(`[mock] 未知 seed：${token}（可用：${Object.keys(SEEDS).join("、")}）`);
    return;
  }
  setup();
}
