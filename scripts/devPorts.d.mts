/**
 * `devPorts.mjs` 的类型声明。
 *
 * 为什么需要这个文件：项目开了 `strict` 但没开 `allowJs`，所以 `.ts` 里 import 一个
 * `.mjs` 会报 TS7016（隐式 any）。这里把导出补成声明，`vite.config.ts` 就能干净地引用；
 * `.mjs` 那侧仍是唯一的值来源（Node 直接跑它，不需要编译）。**别删**——删了编辑器会在
 * `vite.config.ts` 的 import 上标红。
 */

export declare const DEV_PORT: number;
export declare const MOCK_PORT: number;
export declare function localBaseUrl(port: number): string;
