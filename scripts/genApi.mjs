import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "vite";

/**
 * 从后端 OpenAPI 生成 TypeScript 类型到 src/api/schema.d.ts。
 *
 * 地址解析顺序（后者为前者兜底）：
 *   1. shell 环境变量 VITE_OPENAPI_URL / VITE_API_BASE_URL
 *   2. .env / .env.local 中的同名变量（复用 Vite 的加载逻辑）
 *   3. OpenAPI 缺省时取 `${VITE_API_BASE_URL}/openapi.json`
 *   4. 全部缺省时回退 http://localhost:8000
 *
 * 生成前会先修正 spec（见 normalizeDiscriminators），再交给 openapi-typescript。
 *
 * 用法：pnpm gen:api（需后端已启动）
 */
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "VITE_");

const baseUrl = (
  process.env.VITE_API_BASE_URL ??
  env.VITE_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

const url = process.env.VITE_OPENAPI_URL ?? env.VITE_OPENAPI_URL ?? `${baseUrl}/openapi.json`;

/**
 * 删除「判别字段不是 string」的 discriminator。
 *
 * 背景：Pydantic 会为字面量联合（如 `AnyAgentEvent = Union[SpeakEvent, ...]`）生成
 * discriminator，而 discriminator 的 mapping 键只能是字符串（JSON 对象的键必为字符串）。
 * openapi-typescript 见到 discriminator 后会把判别字段**强制渲染成字符串枚举**，
 * 但后端用的是 IntEnum（`type: Literal[EventType.SPEAK]`，即整数 1），运行时是数字——
 * 于是生成类型与真实响应不一致：前端照类型写 `switch (event.type) { case "1": }`，
 * 真实数据却全部落到 default。
 *
 * 删掉这类 discriminator 后，openapi-typescript 按属性真实的 `const` 生成数字字面量
 * （`type: 1`），判别联合在 TypeScript 里依然能正常收窄（`event.type === 1` → SpeakEvent）。
 * 字符串判别字段的 discriminator 保持不动。
 *
 * @returns 被删除的 discriminator 数量
 */
function normalizeDiscriminators(spec) {
  const schemas = spec?.components?.schemas ?? {};
  let removed = 0;

  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    if (node === null || typeof node !== "object") {
      return;
    }

    const discriminator = node.discriminator;
    if (discriminator && typeof discriminator === "object") {
      const propertyName = discriminator.propertyName;
      const refs = Object.values(discriminator.mapping ?? {});
      const kinds = new Set(
        refs
          .map((ref) => String(ref).split("/").pop())
          .map((name) => schemas[name]?.properties?.[propertyName]?.type)
          .filter((kind) => kind !== undefined),
      );
      const isStringDiscriminator = kinds.size === 1 && kinds.has("string");
      if (kinds.size > 0 && !isStringDiscriminator) {
        delete node.discriminator;
        removed += 1;
      }
    }

    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(spec);
  return removed;
}

console.log(`Fetching OpenAPI from ${url} ...`);
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`拉取 OpenAPI 失败：HTTP ${response.status} ${url}`);
}
const spec = await response.json();

const removed = normalizeDiscriminators(spec);
if (removed > 0) {
  console.log(`修正 spec：删除 ${removed} 个非字符串判别字段的 discriminator`);
}

const specDir = mkdtempSync(join(tmpdir(), "ai-rpg-openapi-"));
const specPath = join(specDir, "openapi.json");
writeFileSync(specPath, JSON.stringify(spec));

execFileSync("openapi-typescript", [specPath, "-o", "src/api/schema.d.ts"], {
  stdio: "inherit",
});
console.log("Done: src/api/schema.d.ts");
