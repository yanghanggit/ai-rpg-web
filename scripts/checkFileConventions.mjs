#!/usr/bin/env node
/**
 * 校验 README「约定 / 文件命名」里的「文件名 = 导出符号名」规则。
 *
 * Biome 的 useFilenamingConvention 只能查大小写，查不了文件名与导出符号是否对应，
 * 所以这里用 TypeScript 编译器 API 做确定性检查，避免同类错误再犯。
 *
 * 规则（详见 docs/conventions.md）：
 *   - 组件 / 页面（.tsx）：必须有 default 导出，且导出名 = 文件名。
 *   - 组件 / 页面（.tsx）：只能放在 src/pages/、src/features/、src/components/、src/test/（白名单 src/App.tsx）。
 *   - Hook（.ts，use 开头）：必须导出同名 hook。
 *   - 其余 .ts：只有一个导出且是函数时，文件名 = 函数名；否则按概念命名（不校验）。
 *   - 测试文件：文件名 = 被测模块名（.test 后缀）。
 *   - 无导出文件：仅允许白名单（入口、测试 setup 等约定文件）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
/** 允许「无导出」的约定文件（入口、测试 setup 等）。 */
const ALLOW_NO_EXPORT = new Set(["src/main.tsx", "src/test/setup.ts"]);
/** `.tsx` 允许出现的目录（见 docs/conventions.md 一）。`src/test/` 只放测试专用的外壳组件。 */
const ALLOW_TSX_PREFIXES = ["src/pages/", "src/features/", "src/components/", "src/test/"];
/** `.tsx` 白名单（路由壳）。 */
const ALLOW_TSX_FILES = new Set(["src/App.tsx"]);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function analyze(file) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    kind,
  );

  const named = [];
  let defaultName;

  for (const node of source.statements) {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isExport = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const isDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;

    // export default function X() {} / export default class X {}
    if (isExport && isDefault) {
      defaultName = node.name?.text ?? "<anonymous>";
      continue;
    }
    // export default X;
    if (ts.isExportAssignment(node)) {
      defaultName = ts.isIdentifier(node.expression) ? node.expression.text : "<anonymous>";
      continue;
    }
    // export { a, b }
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          named.push({ name: element.name.text, kind: "reexport" });
        }
      }
      continue;
    }
    if (!isExport) {
      continue;
    }
    // 具名导出：逐个声明种类判断（变量声明要展开 declarationList）
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          named.push({ name: declaration.name.text, kind: "const" });
        }
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      named.push({ name: node.name.text, kind: "function" });
    } else if (ts.isClassDeclaration(node) && node.name) {
      named.push({ name: node.name.text, kind: "class" });
    } else if (ts.isInterfaceDeclaration(node)) {
      named.push({ name: node.name.text, kind: "interface" });
    } else if (ts.isTypeAliasDeclaration(node)) {
      named.push({ name: node.name.text, kind: "type" });
    } else if (ts.isEnumDeclaration(node)) {
      named.push({ name: node.name.text, kind: "enum" });
    }
  }

  return { named, defaultName };
}

const problems = [];

for (const file of walk(SRC)) {
  if (!/\.(ts|tsx)$/.test(file) || file.endsWith(".d.ts")) {
    continue;
  }
  const rel = relative(ROOT, file);
  const base = basename(file).replace(/\.(ts|tsx)$/, "");
  const { named, defaultName } = analyze(file);

  if (named.length === 0 && defaultName === undefined && ALLOW_NO_EXPORT.has(rel)) {
    continue;
  }

  if (base.endsWith(".test")) {
    const subject = base.slice(0, -".test".length);
    const candidates = [`${subject}.ts`, `${subject}.tsx`].map((f) => join(dirname(file), f));
    if (!candidates.some(existsSync)) {
      problems.push(`${rel}: 测试文件没有对应的被测模块 ${subject}.ts(x)`);
    }
    continue;
  }

  if (file.endsWith(".tsx")) {
    const locationOk =
      ALLOW_TSX_FILES.has(rel) || ALLOW_TSX_PREFIXES.some((prefix) => rel.startsWith(prefix));
    if (!locationOk) {
      problems.push(
        `${rel}: .tsx 只能放在 ${ALLOW_TSX_PREFIXES.join("、")}（或用例文件），见 docs/conventions.md`,
      );
    }
    if (defaultName === undefined) {
      problems.push(`${rel}: 组件文件必须以 default 导出组件本身`);
    } else if (defaultName !== base) {
      problems.push(`${rel}: default 导出 ${defaultName} 与文件名不符（应为 ${base}）`);
    }
    continue;
  }

  if (base.startsWith("use")) {
    if (!named.some((item) => item.name === base)) {
      problems.push(`${rel}: hook 文件必须导出名为 ${base} 的 hook`);
    }
    continue;
  }

  if (named.length === 0) {
    problems.push(`${rel}: 无导出（若为约定文件，请加入 ALLOW_NO_EXPORT 白名单）`);
    continue;
  }

  if (named.length === 1 && named[0].kind === "function" && named[0].name !== base) {
    problems.push(`${rel}: 模块只有一个函数导出，文件名应为 ${named[0].name}.ts`);
  }
}

if (problems.length > 0) {
  console.error("文件校验失败（规则见 docs/conventions.md）：\n");
  for (const problem of problems) {
    console.error(`  ✗ ${problem}`);
  }
  process.exit(1);
}

console.log("文件校验通过：命名与 .tsx 位置均符合约定。");
