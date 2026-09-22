/**
 * dev/mock 专用的「深链种子」：把 URL 上的 `?seed=...` 翻译成一份 mock 初始状态。
 *
 * 目的是让 `DevIndexPage` 能直接深链到**任意开场 / 战斗状态**（如 `/dungeon/room?seed=opening:spoils`、
 * `/dungeon/room?seed=combat:turn`），不必每次手动走「进入副本 → 初始化 → …」。它守住既定原则：
 * - **不给 phase 加路由**：路径仍是 `/dungeon/room`，`seed` 只是 mock 指令；
 * - **app / router 零感知**：只有 dev 入口（`main.tsx::enableMocking`）调用它；
 * - **与测试同源**：造状态调的就是测试用的那几个 mock 函数，不引入第二套真值来源。
 *
 * 「表达状态」用**阶段名**（`combat:turn`）而不是原始字段（`state=2`）：前者是意图，后者是实现细节。
 */
import { drawMockCards, initMockCombat, prepareMockPostCombat } from "./combat";
import { advanceMockDungeon, enterMockDungeon } from "./dungeons";
import {
  claimFirstMockSpoilsCard,
  failNextMockOpeningInit,
  generateMockSpoils,
  initMockOpening,
} from "./opening";
import { addMockRosterMember } from "./roster";

/** 种子只服务 fixture 里那份副本；将来要种别的副本，再把副本名并进 token。 */
const DUNGEON = "副本.荒村义庄";

/** 演示用：进副本前把队伍补满（队伍在进入那一刻固化，必须在 enter 之前调用）。 */
function fillParty(): void {
  addMockRosterMember("角色.顾知秋");
  addMockRosterMember("角色.小厮");
}

/** token → 「造出该阶段」的一串 mock 调用（每个 token 覆盖一个 `deriveCombatPhase` 分支）。 */
const SEEDS: Record<string, () => void> = {
  // OPENING：刚进入副本的开场房间，**未初始化**（进入房间那一刻才自动跑初始化）
  "opening:fresh": () => {
    enterMockDungeon(DUNGEON);
  },
  // OPENING：自动初始化失败（标题行那颗 ↻ 变成错误色 = 可重试），再点一次就会成功
  "opening:init-failed": () => {
    enterMockDungeon(DUNGEON);
    failNextMockOpeningInit();
  },
  // OPENING：刚进入副本的开场房间，已初始化（可「生成奖励」）
  "opening:ready": () => {
    enterMockDungeon(DUNGEON);
    initMockOpening();
  },
  // OPENING：开场房间已初始化并生成奖励（角色卡底那颗按钮进第二态「获取奖励」）
  "opening:spoils": () => {
    enterMockDungeon(DUNGEON);
    initMockOpening();
    generateMockSpoils();
  },
  // OPENING：奖励已生成且玩家已领走一张（那颗按钮进第三态「查看奖励」）
  "opening:claimed": () => {
    enterMockDungeon(DUNGEON);
    initMockOpening();
    generateMockSpoils();
    claimFirstMockSpoilsCard("角色.无名");
  },
  // OPENING：队伍里有同伴（用于看 / 调试「牌组」浏览：一级名单里有三个角色）
  "party:full": () => {
    // 名单必须在 enter 之前补：队伍是进副本那一刻固化的
    fillParty();
    enterMockDungeon(DUNGEON);
    initMockOpening();
  },
  // INITIALIZATION：刚推进到战斗房间，等待初始化
  "combat:init": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
  },
  // ONGOING 且无回合：等待「抓牌 / 开启新回合」
  "combat:round_start": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    initMockCombat();
  },
  // ONGOING 且回合已抓牌：轮到某个角色行动
  "combat:turn": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    initMockCombat();
    drawMockCards();
  },
  // POST_COMBAT：结算态（胜利 + 战利品 + 怪物战死）
  "combat:post": () => {
    fillParty();
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
