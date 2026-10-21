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

import { endedRoomKey, markRoomEnded } from "../features/dungeon/endedRooms";
import {
  drawMockCards,
  initMockCombat,
  passMockTurn,
  prepareMockDefeat,
  prepareMockPostCombat,
  setMockDrawPile,
} from "./combat";
import { advanceMockDungeon, enterMockDungeon, readMockDungeonRoom } from "./dungeons";
import { blueprintFixture, turnHandFixture } from "./fixtures";
import { claimFirstMockSpoilsCard, failNextMockOpeningInit, generateMockSpoils } from "./opening";
import { addMockRosterMember } from "./roster";

/** 种子只服务 fixture 里那份副本；将来要种别的副本，再把副本名并进 token。 */
const DUNGEON = "副本.荒废地窟";
const PLAYER = blueprintFixture.player_actor;

/** 演示用：进副本前把队伍补满（队伍在进入那一刻固化，必须在 enter 之前调用）。 */
function fillParty(): void {
  addMockRosterMember("角色.坏运气");
  addMockRosterMember("角色.麻雀");
}

/** 种子上下文：会话（`/game/:user/:game/...`）。客户端记账（「本间已结束」）按会话作 key。 */
interface SeedContext {
  userName: string;
  gameName: string;
}

/** 从深链路径里读出会话（路由表见 `App.tsx`：`/game/:userName/:gameName/...`）。 */
function readSession(url: string): SeedContext {
  const [, , userName = "", gameName = ""] = new URL(url).pathname.split("/");
  return { userName, gameName };
}

/** token → 「造出该阶段」的一串 mock 调用（每个 token 覆盖一个 `deriveCombatPhase` 分支）。 */
const SEEDS: Record<string, (context: SeedContext) => void> = {
  // OPENING：刚进入副本的开场房间（房间侧无状态位；叙事由场景实体给）
  "opening:fresh": () => {
    enterMockDungeon(DUNGEON);
  },
  // OPENING：自动初始化失败（场景卡变成错误色 = 可重试），再点一次就会成功
  "opening:init-failed": () => {
    enterMockDungeon(DUNGEON);
    failNextMockOpeningInit();
  },
  // OPENING：开场房间（初始化已与奖励解耦，本种子与 fresh 等价，保留作深层链兼容）
  "opening:ready": () => {
    enterMockDungeon(DUNGEON);
  },
  // OPENING：已生成奖励（角色卡底那颗按钮进第二态「获取奖励」）
  "opening:spoils": () => {
    enterMockDungeon(DUNGEON);
    generateMockSpoils();
  },
  // OPENING：奖励已生成且玩家已领走一张（那颗按钮进第三态「查看奖励」）
  "opening:claimed": () => {
    enterMockDungeon(DUNGEON);
    generateMockSpoils();
    claimFirstMockSpoilsCard("角色.无名");
  },
  // OPENING：本间已结束（客户端自己记的账）→ 地图上那一行「已完成」、动作搬到下一间
  "opening:ended": ({ userName, gameName }) => {
    enterMockDungeon(DUNGEON);
    const room = readMockDungeonRoom();
    if (room !== null) {
      markRoomEnded(endedRoomKey(userName, gameName, room.stage.name));
    }
  },
  // OPENING：三人队伍 + 已生成奖励（奖励选项按成员各一个，用于核对多人的选项清单）
  "opening:party-spoils": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    generateMockSpoils();
  },
  // OPENING：队伍里有同伴（用于看 / 调试「牌组」浏览：一级名单里有三个角色）
  "party:full": () => {
    // 名单必须在 enter 之前补：队伍是进副本那一刻固化的
    fillParty();
    enterMockDungeon(DUNGEON);
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
  // ONGOING 且回合已抓牌：轮到某个角色行动。手牌换成 `turnHandFixture`——**必含多段命中**，
  // 兼顾目标类型 / 词缀 / 可传递，所以「多段」不再单开一个种子。
  "combat:turn": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    initMockCombat();
    setMockDrawPile(PLAYER, turnHandFixture);
    drawMockCards();
  },
  // ONGOING 且轮到某个**怪物**行动（队伍与怪物交错，所以玩家过牌一次后就是怪物）：
  // 手牌只读、右列是「推进怪物回合」。用来看名单上穿插的怪物格与怪物手牌。
  "combat:monster": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    initMockCombat();
    setMockDrawPile(PLAYER, turnHandFixture);
    drawMockCards();
    passMockTurn();
  },
  // POST_COMBAT：结算态（胜利 + 战利品 + 怪物战死）
  "combat:post": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    prepareMockPostCombat();
  },
  // POST_COMBAT：战败结算态（我方全灭 + 无战利品）
  "combat:defeat": () => {
    fillParty();
    enterMockDungeon(DUNGEON);
    advanceMockDungeon();
    prepareMockDefeat();
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
  setup(readSession(url));
}
