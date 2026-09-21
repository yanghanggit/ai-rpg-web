import { HttpHandler } from "msw";
import { describe, expect, it } from "vitest";
import { API_BASE_URL, client, unwrap } from "../api/client";
import { API_PATHS } from "../api/schemaPaths";
import { advanceMockDungeon, enterMockDungeon } from "./dungeons";
import { blueprintFixture } from "./fixtures";
import { handlers } from "./handlers";

const USER = "webdev";
const GAME = "Game1";
const PLAYER = blueprintFixture.player_actor;
const COMBAT_STAGE = "场景.停柩房";

const path = { user_name: USER, game_name: GAME };

async function getRoom() {
  return unwrap(
    await client.GET("/api/dungeons/v1/{user_name}/{game_name}/room", { params: { path } }),
  );
}

async function getCombat() {
  const { room } = await getRoom();
  if (room.type !== "combat") {
    throw new Error(`期望战斗房间，实际是 ${room.type}`);
  }
  return room.combat;
}

/** 进入副本并推进到战斗房间（复用 mock 的同步推进）。 */
function enterCombat(): void {
  enterMockDungeon("副本.荒村义庄");
  advanceMockDungeon();
}

describe("战斗房间接口（mock handlers）", () => {
  it("初始化 → 抓牌：房间状态与实体组件同步变化", async () => {
    enterCombat();

    // 刚进战斗房间：INITIALIZATION
    expect((await getCombat()).state).toBe(1);

    // 初始化任务：只返回 job_id，状态变化在 mock 里同步发生
    const init = unwrap(await client.POST("/api/dungeon/combat/init/v1/", { body: { ...path } }));
    expect(init.job_id).toBeGreaterThan(0);
    expect((await getCombat()).state).toBe(2);

    // 抓牌：开出第一个回合
    unwrap(await client.POST("/api/dungeon/combat/draw_cards/v1/", { body: { ...path } }));
    const combat = await getCombat();
    expect(combat.rounds).toHaveLength(1);
    expect(combat.rounds[0]?.current_actor).toBe(PLAYER);

    // 玩家实体读到了战斗组件
    const details = unwrap(
      await client.GET("/api/entities/v1/{user_name}/{game_name}/details", {
        params: { path, query: { entities: [PLAYER] } },
      }),
    );
    const components = details.entities[0]?.components ?? [];
    expect(components.some((component) => component.name === "HandComponent")).toBe(true);
    expect(components.some((component) => component.name === "RoundStatsComponent")).toBe(true);

    // 场景映射里能按玩家定位到战斗场景，且怪物在场
    const stages = unwrap(
      await client.GET("/api/stages/v1/{user_name}/{game_name}/state", { params: { path } }),
    );
    expect(stages.actors_by_stage[COMBAT_STAGE]).toContain(PLAYER);
    expect(stages.actors_by_stage[COMBAT_STAGE]).toContain("怪物.纸人");
  });

  it("未抓牌就出牌：handler 返回 400（与后端前置校验一致）", async () => {
    enterCombat();
    unwrap(await client.POST("/api/dungeon/combat/init/v1/", { body: { ...path } }));

    const result = await client.POST("/api/dungeon/combat/play_cards/v1/", {
      body: { ...path, actor_name: PLAYER, card_name: "剖棺", targets: ["怪物.纸人"] },
    });
    expect(result.response.status).toBe(400);
  });

  it("领取战利品：同步接口，直接返回 message", async () => {
    enterCombat();
    unwrap(await client.POST("/api/dungeon/combat/init/v1/", { body: { ...path } }));

    const result = await client.POST("/api/dungeon/combat/collect_loot/v1/", {
      body: { ...path },
    });
    // 没有战利品时后端 409
    expect(result.response.status).toBe(409);
  });
});

/**
 * 契约守卫：MSW handler 用的是真实路径字符串，不在 openapi-fetch 的类型检查范围内。
 * 后端改了路径、`pnpm gen:api` 更新了 schema 后，生产代码会 typecheck 失败，但
 * `handlers.ts` 里的字符串不会——`schemaPaths.ts` 就是为这道守卫生成的运行时路径清单。
 *
 * 参数写法两边不同，比对前先归一：契约用 `{user_name}`，MSW 用 `:userName`。
 */
function normalizePath(path: string): string {
  return path.replace(/\{[^}]*\}/g, "{}").replace(/\/:[^/]+/g, "/{}");
}

/** handler 注册的完整 URL 去掉 base，回到契约里的相对路径。 */
function handlerPath(handler: HttpHandler): string | null {
  const { path } = handler.info;
  if (typeof path !== "string") {
    return null;
  }
  return path.startsWith(API_BASE_URL) ? path.slice(API_BASE_URL.length) : path;
}

describe("MSW handler 路径守卫", () => {
  it("每个 handler 路径都存在于生成的 OpenAPI 契约中", () => {
    const contract = new Set(API_PATHS.map(normalizePath));
    const orphans = handlers
      .flatMap((handler) => (handler instanceof HttpHandler ? [handler] : []))
      .map(handlerPath)
      .filter((path): path is string => path !== null)
      .map(normalizePath)
      .filter((path) => !contract.has(path));

    expect(orphans).toEqual([]);
  });
});
