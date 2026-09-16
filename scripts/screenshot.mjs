#!/usr/bin/env node
/**
 * 给页面截图（视觉核对用）：起一个 headless Chrome，**导航 → 等 → 可选点击 → 截图**。
 *
 * 为什么不直接用 `chrome --headless --screenshot`：
 * - 命令行截图在 load 事件就落笔，而本项目的首屏要等 React 挂载、mock 模式还要等
 *   MSW 的 service worker 接管，于是**拍出来是空白页**（试过 `--virtual-time-budget`，
 *   在 headless=new 下也救不回来）；
 * - 它还无法「先点一下再拍」，而浮窗、二级浮窗这些正是最需要看的。
 * 所以走 CDP（DevTools 协议）：能用 Node 内置的 `fetch` + `WebSocket` 说话，不必装 puppeteer。
 *
 * 用法（`pnpm screenshot ...`）：
 *   pnpm screenshot /game/webdev/Game1/dungeon
 *   pnpm screenshot /game/webdev/Game1/dungeon --mock                            # mock 模式
 *   pnpm screenshot /game/webdev/Game1/dungeon --size 1024x768 --click "进入副本：荒村义庄"
 *   pnpm screenshot /game/webdev/Game1/dungeon --base http://192.168.1.5:<本机 dev 端口>   # 局域网真机
 *
 * 端口不在这里写死：默认地址由 scripts/devPorts.mjs 派生（`vite.config.ts` 也从那里取）。
 * 输出默认落到 `screenshots/`（已 gitignore）。依赖本机的 Chrome / Chromium。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEV_PORT, localBaseUrl, MOCK_PORT } from "./devPorts.mjs";

const DEFAULT_SIZE = "1280x900";
const DEFAULT_WAIT_MS = 4000;
const DEFAULT_CLICK_WAIT_MS = 2000;

/** 找得到就用的浏览器；`CHROME_PATH` 优先。 */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate) => typeof candidate === "string" && candidate !== "");

const USAGE = `用真实浏览器给页面截图：导航 → 等待 → （可选）点击 → 截图。

用法：pnpm screenshot <路径或 URL> [选项]

  <路径或 URL>       如 /game/webdev/Game1/dungeon；给完整 URL 则忽略 --base / --mock

选项：
  --mock             拍 mock 模式的 dev server（端口 ${MOCK_PORT}，见 scripts/devPorts.mjs）
  --base <url>       显式指定地址（如局域网真机）；与 --mock 二选一
                     都不给则拍 ${localBaseUrl(DEV_PORT)}（pnpm dev）
  --out <file>       输出文件，默认 screenshots/<路径末段>-<宽>x<高>.png
  --size <宽x高>     视口尺寸，默认 ${DEFAULT_SIZE}；本项目只保证桌面（最小宽度 1024）
  --click <文本>     截图前点一下这个按钮（按 aria-label 或按钮文字匹配）
                     用 | 分隔可连点多下，如：--click "加入|进入副本：荒村义庄"
  --wait <ms>        导航后等待，默认 ${DEFAULT_WAIT_MS}（等 React 挂载与接口返回）
  --click-wait <ms>  每次点击后等待，默认 ${DEFAULT_CLICK_WAIT_MS}

环境变量：
  CHROME_PATH        指定浏览器可执行文件（默认按常见路径找 Chrome / Chromium）`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const options = {
    target: "",
    base: "",
    mock: false,
    out: "",
    size: DEFAULT_SIZE,
    click: "",
    wait: DEFAULT_WAIT_MS,
    clickWait: DEFAULT_CLICK_WAIT_MS,
    help: false,
  };
  const flags = {
    "--mock": () => {
      options.mock = true;
    },
    "--base": (value) => {
      options.base = value;
    },
    "--out": (value) => {
      options.out = value;
    },
    "--size": (value) => {
      options.size = value;
    },
    "--click": (value) => {
      options.click = value;
    },
    "--wait": (value) => {
      options.wait = Number(value);
    },
    "--click-wait": (value) => {
      options.clickWait = Number(value);
    },
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const apply = flags[arg];
    if (apply === undefined) {
      positional.push(arg);
      continue;
    }
    // 布尔开关（--mock）不吃后面的值
    if (arg === "--mock") {
      apply();
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(`选项 ${arg} 缺少取值`);
    }
    apply(value);
    index += 1;
  }

  if (positional.length > 1) {
    throw new Error(`多余的参数：${positional.slice(1).join(" ")}`);
  }
  if (options.mock && options.base !== "") {
    throw new Error("--base 与 --mock 二选一（给 --base 就按它的地址拍）");
  }
  options.target = positional[0] ?? "";
  // 默认地址派生自 devPorts.mjs：本文件不写死端口
  options.base =
    options.base !== "" ? options.base : localBaseUrl(options.mock ? MOCK_PORT : DEV_PORT);
  return options;
}

/** 默认文件名：路径末段 + 视口，例如 screenshots/dungeon-1280x900.png。 */
function defaultOut(target, size) {
  const slug = target.split("?")[0]?.split("/").filter(Boolean).pop() ?? "page";
  return join("screenshots", `${slug}-${size}.png`);
}

/** Chrome 把实际调试端口写在这里（用 `--remote-debugging-port=0` 就不必猜端口）。 */
async function readDevToolsPort(profileDir, timeoutMs) {
  const portFile = join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(portFile)) {
      const [port] = readFileSync(portFile, "utf8").split("\n");
      if (port !== undefined && port !== "") {
        return Number(port);
      }
    }
    await sleep(150);
  }
  throw new Error("等不到浏览器的调试端口（DevToolsActivePort）");
}

async function findPageTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl !== undefined) {
        return page;
      }
    } catch {
      // 调试端口刚起来时可能还连不上，重试即可
    }
    await sleep(150);
  }
  throw new Error("找不到可用的浏览器标签页");
}

/** 连上 CDP 并返回 `send(method, params)`（Promise 化）。 */
async function connectDevTools(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("连不上浏览器的调试接口")), {
      once: true,
    });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (resolve === undefined) {
      return;
    }
    pending.delete(message.id);
    resolve(message.result);
  });

  return {
    send(method, params = {}) {
      nextId += 1;
      const id = nextId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

/** 点击脚本：找不到就回报名单，省得为了一个文案来回猜。 */
function clickExpression(label) {
  return `(() => {
    const wanted = ${JSON.stringify(label)};
    const buttons = [...document.querySelectorAll("button")];
    const hit = buttons.find(
      (button) => button.getAttribute("aria-label") === wanted || button.textContent.trim() === wanted,
    );
    if (hit !== undefined) {
      hit.click();
      return "ok";
    }
    return buttons
      .map((button) => button.getAttribute("aria-label") ?? button.textContent.trim())
      .join(" | ");
  })()`;
}

async function evaluate(cdp, expression) {
  const { result } = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  return result.value;
}

/**
 * 删临时 profile。
 *
 * Chrome 被 kill 后还可能再写几下（目录非空），所以带重试；而且**清理失败不能
 * 让截图本身变成失败**——两者的成败是两件事。
 */
function removeProfileDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // 临时目录留着也无害，交给系统回收
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || options.target === "") {
    console.log(USAGE);
    process.exit(options.help ? 0 : 1);
  }

  const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (chrome === undefined) {
    throw new Error(
      `找不到 Chrome / Chromium，请用 CHROME_PATH 指定：\n  ${CHROME_CANDIDATES.join("\n  ")}`,
    );
  }

  const [width, height] = options.size.split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`--size 应为「宽x高」，如 1024x768（收到 ${options.size}）`);
  }

  const url = options.target.startsWith("http")
    ? options.target
    : `${options.base.replace(/\/$/, "")}${options.target}`;
  const out = options.out === "" ? defaultOut(options.target, options.size) : options.out;
  mkdirSync(dirname(out), { recursive: true });

  // 每次都用全新的临时 profile：MSW 的 service worker 与登录态都不该跨次残留
  const profileDir = mkdtempSync(join(tmpdir(), "ai-rpg-web-shot-"));
  const browser = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const port = await readDevToolsPort(profileDir, 15000);
    const page = await findPageTarget(port, 15000);
    const cdp = await connectDevTools(page.webSocketDebuggerUrl);

    try {
      // 用 Emulation 定视口，而不是 --window-size：后者在 headless 下有最小宽度，
      // 想验 1024px 这类较窄的桌面会被悄悄放大（也就验不出横向溢出）。
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Page.enable");
      await cdp.send("Page.navigate", { url });
      await sleep(options.wait);

      const mounted = await evaluate(
        cdp,
        "document.getElementById('root')?.childElementCount ?? 0",
      );
      if (mounted === 0) {
        throw new Error(
          `页面没渲染出来（#root 是空的）：${url}\n  确认 dev server 在 ${options.base} 跑着吗？也可能是等得不够（--wait / 加大）`,
        );
      }

      for (const label of options.click.split("|").map((entry) => entry.trim())) {
        if (label === "") {
          continue;
        }
        const clicked = await evaluate(cdp, clickExpression(label));
        if (clicked !== "ok") {
          throw new Error(
            `页面上没有按钮「${label}」。当前按钮：\n  ${String(clicked).split(" | ").join("\n  ")}`,
          );
        }
        await sleep(options.clickWait);
      }

      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(out, Buffer.from(shot.data, "base64"));
    } finally {
      cdp.close();
    }
  } finally {
    browser.kill();
    removeProfileDir(profileDir);
  }

  console.log(`已截图：${out}\n  视口 ${width}x${height} · ${url}`);
}

main().catch((error) => {
  console.error(`截图失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
