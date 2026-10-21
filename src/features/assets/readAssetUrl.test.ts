import { describe, expect, it } from "vitest";
import { readAssetUrl } from "./readAssetUrl";

/**
 * 资产的 meta 路径 → 静态文件 URL：规则与后端 `asset_url()` 一致（filename + 服务端前缀），
 * 客户端不存第二份映射。取不到就返回 `null`，由调用方决定占位。
 */
describe("readAssetUrl", () => {
  it("meta 路径 → URL：去掉 `.meta`、拼上服务端给的静态前缀", () => {
    const url = readAssetUrl(
      { illustration: ".assets/image/20260101T000000Z_abc.png.meta" },
      "illustration",
      "/assets/image",
    );

    expect(url).toMatch(/\/assets\/image\/20260101T000000Z_abc\.png$/);
  });

  it("没有这个资产 → null", () => {
    expect(readAssetUrl({}, "illustration", "/assets/image")).toBeNull();
    expect(readAssetUrl(undefined, "illustration", "/assets/image")).toBeNull();
  });

  it("值是空串（后端表示无资产）→ null", () => {
    expect(readAssetUrl({ illustration: "" }, "illustration", "/assets/image")).toBeNull();
  });

  it("前缀还没到（`GET /` 未返回）→ null：不猜一个地址去挂 broken image", () => {
    expect(
      readAssetUrl({ illustration: ".assets/image/a.png.meta" }, "illustration", null),
    ).toBeNull();
  });
});
