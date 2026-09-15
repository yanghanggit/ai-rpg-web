#!/usr/bin/env node
/**
 * 校验「dev server 端口只有一个来源」。
 *
 * 端口散落各处时，坏结果不是报错，而是**悄悄指向另一台服务器**：本机某个端口上跑着
 * 连着真实后端的 dev server 时，任何「默认那个端口」的工具都会拍到它，而你以为拍的是 mock。
 * 所以数字只允许写在 `scripts/devPorts.mjs`（由 `vite.config.ts` 与
 * `scripts/screenshot.mjs` 引入），这里做机械检查，不靠自觉。
 *
 * 连**注释**也一起管：注释里的数字同样会过期，而代价只是「改写成提模块名」
 * （所以本文件自己也只说「dev 端口」，不写具体数字）。
 *
 * 为什么不查 docs/*.md：Markdown 没法 import，只能手写；端口只有两个且极少变动，
 * 由 docs/dev-setup.md 的「端口」一节集中说明即可。本脚本盯的是**代码**。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DEV_PORT, MOCK_PORT } from "./devPorts.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
/** 不扫的目录：依赖、构建产物、截图、编辑器缓存。 */
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "screenshots", ".VSCodeCounter"]);
/** 允许出现端口数字的文件（值的唯一来源 + 它的类型声明）。 */
const ALLOWED_FILES = new Set(["scripts/devPorts.mjs", "scripts/devPorts.d.mts"]);
/** 只扫这些后缀；`.d.ts` 另排除（生成物 / 声明，不该被当源码看）。 */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".json", ".html"];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) {
      return [];
    }
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** 端口字面量：前后都不能紧挨数字，避免把 15173 这类当成端口。 */
function portPattern(port) {
  return new RegExp(`(?<!\\d)${port}(?!\\d)`);
}

const problems = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (ALLOWED_FILES.has(rel) || file.endsWith(".d.ts")) {
    continue;
  }
  if (!SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) {
    continue;
  }

  const lines = readFileSync(file, "utf8").split("\n");
  for (const port of [DEV_PORT, MOCK_PORT]) {
    const pattern = portPattern(port);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        problems.push(`${rel}:${index + 1}: 出现了端口 ${port}，请从 scripts/devPorts.mjs 引入`);
      }
    });
  }
}

if (problems.length > 0) {
  console.error("端口来源校验失败（规则见 scripts/devPorts.mjs 头注释）：\n");
  for (const problem of problems) {
    console.error(`  ✗ ${problem}`);
  }
  process.exit(1);
}

console.log(`端口校验通过：${DEV_PORT} / ${MOCK_PORT} 只定义在 scripts/devPorts.mjs。`);
