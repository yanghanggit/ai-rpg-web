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
 * 生成前会先校验 spec（见 assertStringDiscriminators），再交给 openapi-typescript。
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
 * 断言 spec 里没有「判别字段不是 string」的 discriminator，否则直接让生成失败。
 *
 * 背景：discriminator 的 mapping 键只能是字符串（JSON 对象的键必为字符串），
 * 所以 openapi-typescript 一见到 discriminator，就把判别字段渲染成**字符串枚举**。
 * 若后端用 IntEnum（`type: Literal[EventType.SPEAK]`，运行时是数字 1），
 * 生成类型会声称 `type: "1"`，而真实响应是 `1` —— 前端照类型写出的 switch
 * 会全部落到 default，且**不会报任何错**。
 *
 * 这类失真靠自觉发现不了，所以这里选择报错而不是自动"修正"：自动删掉 discriminator
 * 能救回类型，却也把"后端契约有异味"这件事悄悄吞掉了。让生成失败，问题就必须在源头解决。
 *
 * 修法：后端把判别字段改成字符串字面量（如 `type: Literal["speak"] = "speak"`）。
 * 详见 docs/api-layer.md §六。
 */
function assertStringDiscriminators(spec) {
  const schemas = spec?.components?.schemas ?? {};
  const violations = [];

  const visit = (node, path) => {
    if (Array.isArray(node)) {
      for (const [index, item] of node.entries()) {
        visit(item, `${path}[${index}]`);
      }
      return;
    }
    if (node === null || typeof node !== "object") {
      return;
    }

    const discriminator = node.discriminator;
    if (discriminator && typeof discriminator === "object") {
      const propertyName = discriminator.propertyName;
      const kinds = new Set(
        Object.values(discriminator.mapping ?? {})
          .map((ref) => String(ref).split("/").pop())
          .map((name) => schemas[name]?.properties?.[propertyName]?.type)
          .filter((kind) => kind !== undefined),
      );
      const isStringDiscriminator = kinds.size === 1 && kinds.has("string");
      if (kinds.size > 0 && !isStringDiscriminator) {
        violations.push(
          `${path}（判别字段 "${propertyName}" 的实际类型是 ${[...kinds].join(" / ")}）`,
        );
      }
    }

    for (const [key, value] of Object.entries(node)) {
      visit(value, path ? `${path}.${key}` : key);
    }
  };

  visit(spec, "");

  if (violations.length > 0) {
    throw new Error(
      `spec 里有 ${violations.length} 个非字符串判别字段的 discriminator，` +
        `生成的类型会是错的：\n` +
        violations.map((violation) => `  - ${violation}`).join("\n") +
        `\n请把后端对应的 Literal 改成字符串（见 docs/api-layer.md §六）。`,
    );
  }
}

console.log(`Fetching OpenAPI from ${url} ...`);
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`拉取 OpenAPI 失败：HTTP ${response.status} ${url}`);
}
const spec = await response.json();

assertStringDiscriminators(spec);

const specDir = mkdtempSync(join(tmpdir(), "ai-rpg-openapi-"));
const specPath = join(specDir, "openapi.json");
writeFileSync(specPath, JSON.stringify(spec));

execFileSync("openapi-typescript", [specPath, "-o", "src/api/schema.d.ts"], {
  stdio: "inherit",
});
console.log("Done: src/api/schema.d.ts");
